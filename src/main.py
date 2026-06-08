"""月度汇算小工具 - 主程序入口 & GUI 界面"""

import logging
import logging.handlers
import os
import sys
import tkinter as tk
from dataclasses import dataclass, field
from datetime import datetime
from tkinter import filedialog, messagebox, ttk
from typing import Any

from src.config import (
    InputSource,
    SOURCE_COLUMNS,
)
from src.excel_handler import (
    AnomalyRecord,
    ColumnMapper,
    DataAnalyzer,
    ExcelHandler,
    ExcelExporter,
)
from src.fifo_engine import (
    CalcResult,
    FIFOEngine,
)

logger = logging.getLogger("monthly_settlement")


@dataclass
class SourceState:
    """单个输入来源的状态"""
    file_path: str | None = None
    sheet_name: str | None = None
    header_row: int = 1        # 标题行号（Excel行号，从1开始）
    last_row: int = 0          # 最后一行数据行号（0表示到末尾）
    sheet_columns: list[str] = field(default_factory=list)
    raw_data: list[dict] = field(default_factory=list)
    column_mapping: dict[str, str | None] = field(default_factory=dict)
    preview_data: list[dict] = field(default_factory=list)
    stats: dict = field(default_factory=dict)
    anomalies: list[AnomalyRecord] = field(default_factory=list)


class AppState:
    """应用状态，管理3个输入来源的文件/sheet/映射/数据"""

    def __init__(self):
        self.sources: dict[InputSource, SourceState] = {
            InputSource.INBOUND: SourceState(),
            InputSource.OPENING: SourceState(),
            InputSource.OUTBOUND: SourceState(),
        }
        self.calc_result: CalcResult | None = None


class MonthlySettlementApp:
    """月度汇算小工具主应用"""

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("月度汇算小工具")
        self.root.geometry("960x720")
        self.root.minsize(800, 600)

        self.state = AppState()
        self.mapper = ColumnMapper()
        self.analyzer = DataAnalyzer()
        self.engine = FIFOEngine()
        self.exporter = ExcelExporter()
        self.handlers: dict[InputSource, ExcelHandler | None] = {
            InputSource.INBOUND: None,
            InputSource.OPENING: None,
            InputSource.OUTBOUND: None,
        }

        # UI 组件引用
        self.sheet_combos: dict[InputSource, ttk.Combobox] = {}
        self.header_row_spins: dict[InputSource, ttk.Spinbox] = {}
        self.last_row_spins: dict[InputSource, ttk.Spinbox] = {}
        self.mapping_combos: dict[InputSource, dict[str, ttk.Combobox]] = {}
        self.preview_trees: dict[InputSource, ttk.Treeview] = {}
        self.stats_labels: dict[InputSource, ttk.Label] = {}
        self.anomaly_labels: dict[InputSource, ttk.Label] = {}
        self.row_range_labels: dict[InputSource, ttk.Label] = {}
        self.total_excel_rows: dict[InputSource, int] = {}
        self._column_display_to_key: dict[InputSource, dict[str, str]] = {}

        # 计算结果 tab 组件
        self.result_closing_tree: ttk.Treeview | None = None
        self.result_outbound_tree: ttk.Treeview | None = None
        self.result_warning_label: ttk.Label | None = None

        # 入库 TAB 批次明细组件
        self.batch_material_combo: ttk.Combobox | None = None
        self.batch_tree: ttk.Treeview | None = None
        self.batch_summary_label: ttk.Label | None = None
        self.batch_frame: ttk.LabelFrame | None = None

        self._build_ui()

    def _build_ui(self):
        """构建界面：三个输入页签 + 计算结果页签 + 底部操作按钮"""
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=(10, 0))

        for source in InputSource:
            tab = ttk.Frame(self.notebook)
            self.notebook.add(tab, text=source.value)
            self._build_source_tab(tab, source)

        # 计算结果 tab
        self.result_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.result_tab, text="计算结果")
        self._build_result_tab(self.result_tab)

        btn_frame = ttk.Frame(self.root)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        ttk.Button(btn_frame, text="开始计算 →", command=self._on_start_calc).pack(side=tk.RIGHT, padx=10)

        # 监听 tab 切换
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_changed)

    def _build_source_tab(self, tab: ttk.Frame, source: InputSource):
        """构建单个来源的 tab：文件选择 + 跳过行 + 列映射 + 预览"""

        # ---- 上半部分：文件选择 + 跳过行 + 列映射 ----
        top_frame = ttk.Frame(tab)
        top_frame.pack(fill=tk.X, padx=5, pady=5)

        # 文件选择行
        file_frame = ttk.Frame(top_frame)
        file_frame.pack(fill=tk.X, pady=2)

        ttk.Label(file_frame, text="文件:", width=5).pack(side=tk.LEFT)
        file_entry = ttk.Entry(file_frame, width=50)
        file_entry.pack(side=tk.LEFT, padx=5)
        setattr(self, f"file_entry_{source.name}", file_entry)

        ttk.Button(file_frame, text="选择文件",
                    command=lambda s=source: self._on_file_selected(s)).pack(side=tk.LEFT, padx=5)

        ttk.Label(file_frame, text="Sheet:", width=6).pack(side=tk.LEFT, padx=(10, 0))
        sheet_combo = ttk.Combobox(file_frame, state="readonly", width=20)
        sheet_combo.pack(side=tk.LEFT, padx=5)
        sheet_combo.bind("<<ComboboxSelected>>", lambda e, s=source: self._on_sheet_selected(s))
        self.sheet_combos[source] = sheet_combo

        # 跳过行 + 列映射（左右布局）
        config_frame = ttk.Frame(top_frame)
        config_frame.pack(fill=tk.X, pady=2)

        # 左侧：行范围
        range_frame = ttk.LabelFrame(config_frame, text="行范围")
        range_frame.pack(side=tk.LEFT, padx=(0, 5), fill=tk.Y)

        range_row1 = ttk.Frame(range_frame)
        range_row1.pack(padx=5, pady=2, anchor=tk.W)
        ttk.Label(range_row1, text="标题行: 第").pack(side=tk.LEFT)
        header_row_spin = ttk.Spinbox(range_row1, from_=1, to=100, width=4,
                                       command=lambda s=source: self._on_range_changed(s))
        header_row_spin.set(1)
        header_row_spin.pack(side=tk.LEFT, padx=2)
        header_row_spin.bind("<Return>", lambda e, s=source: self._on_range_changed(s))
        header_row_spin.bind("<FocusOut>", lambda e, s=source: self._on_range_changed(s))
        self.header_row_spins[source] = header_row_spin
        ttk.Label(range_row1, text="行").pack(side=tk.LEFT)

        range_row2 = ttk.Frame(range_frame)
        range_row2.pack(padx=5, pady=2, anchor=tk.W)
        ttk.Label(range_row2, text="末尾行: 第").pack(side=tk.LEFT)
        last_row_spin = ttk.Spinbox(range_row2, from_=1, to=9999, width=4,
                                     command=lambda s=source: self._on_range_changed(s))
        last_row_spin.set(0)  # 0 表示到末尾
        last_row_spin.pack(side=tk.LEFT, padx=2)
        last_row_spin.bind("<Return>", lambda e, s=source: self._on_range_changed(s))
        last_row_spin.bind("<FocusOut>", lambda e, s=source: self._on_range_changed(s))
        self.last_row_spins[source] = last_row_spin
        ttk.Label(range_row2, text="行(0=末尾)").pack(side=tk.LEFT)

        # 行范围提示
        range_row3 = ttk.Frame(range_frame)
        range_row3.pack(padx=5, pady=(4, 2))
        row_range_label = ttk.Label(range_row3, text="", foreground="gray")
        row_range_label.pack(side=tk.LEFT)
        self.row_range_labels[source] = row_range_label

        # 右侧：列映射
        mapping_frame = ttk.LabelFrame(config_frame, text="列映射")
        mapping_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.mapping_combos[source] = {}
        col_defs = SOURCE_COLUMNS[source]
        for col_def in col_defs:
            row = ttk.Frame(mapping_frame)
            row.pack(fill=tk.X, padx=5, pady=1)
            ttk.Label(row, text=col_def.display + ":", width=10).pack(side=tk.LEFT)
            combo = ttk.Combobox(row, state="readonly", width=20)
            combo.pack(side=tk.LEFT, padx=5)
            combo.bind("<<ComboboxSelected>>", lambda e, s=source: self._on_mapping_changed(s))
            self.mapping_combos[source][col_def.key] = combo

        # ---- 下半部分：数据预览 ----
        preview_frame = ttk.LabelFrame(tab, text="数据预览")
        preview_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Treeview 样式：带边框线效果
        style = ttk.Style()
        style.configure("Preview.Treeview",
                        rowheight=24,
                        borderwidth=1,
                        relief="solid",
                        fieldbackground="white")
        style.configure("Preview.Treeview.Heading",
                        relief="groove",
                        borderwidth=1)
        style.map("Preview.Treeview",
                  background=[("selected", "#0078D7")],
                  foreground=[("selected", "white")])

        # Treeview
        tree_frame = ttk.Frame(preview_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        tree = ttk.Treeview(tree_frame, show="headings", height=12,
                            style="Preview.Treeview")
        tree.tag_configure("even", background="#F5F5F5")
        tree.tag_configure("odd", background="white")
        tree.tag_configure("anomaly", background="#FFE0E0")
        x_scroll = ttk.Scrollbar(tree_frame, orient=tk.HORIZONTAL, command=tree.xview)
        y_scroll = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(xscrollcommand=x_scroll.set, yscrollcommand=y_scroll.set)
        tree.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        x_scroll.grid(row=1, column=0, sticky="ew")
        tree_frame.grid_rowconfigure(0, weight=1)
        tree_frame.grid_columnconfigure(0, weight=1)
        self.preview_trees[source] = tree

        # 统计信息
        stats_label = ttk.Label(preview_frame, text="")
        stats_label.pack(fill=tk.X, padx=5)
        self.stats_labels[source] = stats_label

        # 异常信息
        anomaly_label = ttk.Label(preview_frame, text="", foreground="red",
                                   wraplength=900, justify=tk.LEFT)
        anomaly_label.pack(fill=tk.X, padx=5)
        self.anomaly_labels[source] = anomaly_label

        # 入库 TAB 底部批次明细区域（初始隐藏）
        if source == InputSource.INBOUND:
            self._build_batch_detail(tab)

    def _build_batch_detail(self, tab: ttk.Frame):
        """构建入库 TAB 底部的批次明细区域"""
        self.batch_frame = ttk.LabelFrame(tab, text="批次明细")
        # 初始不 pack，计算后显示

        # 物料选择行
        select_row = ttk.Frame(self.batch_frame)
        select_row.pack(fill=tk.X, padx=5, pady=2)
        ttk.Label(select_row, text="物料:").pack(side=tk.LEFT)
        self.batch_material_combo = ttk.Combobox(select_row, state="readonly", width=20)
        self.batch_material_combo.pack(side=tk.LEFT, padx=5)
        self.batch_material_combo.bind("<<ComboboxSelected>>", self._on_batch_material_selected)

        # 批次明细表格
        batch_tree_frame = ttk.Frame(self.batch_frame)
        batch_tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.batch_tree = ttk.Treeview(
            batch_tree_frame, show="headings", height=6,
            columns=["source", "date", "original_qty", "consumed_qty", "remaining_qty", "price"],
            style="Preview.Treeview",
        )
        self.batch_tree.heading("source", text="来源")
        self.batch_tree.heading("date", text="日期")
        self.batch_tree.heading("original_qty", text="原始数量")
        self.batch_tree.heading("consumed_qty", text="消耗数量")
        self.batch_tree.heading("remaining_qty", text="剩余数量")
        self.batch_tree.heading("price", text="单价")
        self.batch_tree.column("source", width=60, anchor=tk.CENTER)
        self.batch_tree.column("date", width=100, anchor=tk.CENTER)
        self.batch_tree.column("original_qty", width=80, anchor=tk.E)
        self.batch_tree.column("consumed_qty", width=80, anchor=tk.E)
        self.batch_tree.column("remaining_qty", width=80, anchor=tk.E)
        self.batch_tree.column("price", width=80, anchor=tk.E)
        self.batch_tree.tag_configure("consumed", foreground="gray")
        self.batch_tree.tag_configure("even", background="#F5F5F5")
        self.batch_tree.tag_configure("odd", background="white")

        y_scroll = ttk.Scrollbar(batch_tree_frame, orient=tk.VERTICAL, command=self.batch_tree.yview)
        self.batch_tree.configure(yscrollcommand=y_scroll.set)
        self.batch_tree.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        batch_tree_frame.grid_rowconfigure(0, weight=1)
        batch_tree_frame.grid_columnconfigure(0, weight=1)

        # 汇总行
        self.batch_summary_label = ttk.Label(self.batch_frame, text="")
        self.batch_summary_label.pack(fill=tk.X, padx=5, pady=2)

    def _build_result_tab(self, tab: ttk.Frame):
        """构建计算结果 tab"""
        # 期末库存
        closing_frame = ttk.LabelFrame(tab, text="期末库存")
        closing_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        closing_tree_frame = ttk.Frame(closing_frame)
        closing_tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.result_closing_tree = ttk.Treeview(
            closing_tree_frame, show="headings", height=8,
            columns=["material", "quantity", "price", "amount"],
            style="Preview.Treeview",
        )
        self.result_closing_tree.heading("material", text="物料名称")
        self.result_closing_tree.heading("quantity", text="数量")
        self.result_closing_tree.heading("price", text="单价")
        self.result_closing_tree.heading("amount", text="金额")
        self.result_closing_tree.column("material", width=200, anchor=tk.W)
        self.result_closing_tree.column("quantity", width=100, anchor=tk.E)
        self.result_closing_tree.column("price", width=100, anchor=tk.E)
        self.result_closing_tree.column("amount", width=120, anchor=tk.E)
        self.result_closing_tree.tag_configure("warning", background="#FFFF00")
        self.result_closing_tree.tag_configure("even", background="#F5F5F5")
        self.result_closing_tree.tag_configure("odd", background="white")

        y_scroll = ttk.Scrollbar(closing_tree_frame, orient=tk.VERTICAL,
                                  command=self.result_closing_tree.yview)
        self.result_closing_tree.configure(yscrollcommand=y_scroll.set)
        self.result_closing_tree.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        closing_tree_frame.grid_rowconfigure(0, weight=1)
        closing_tree_frame.grid_columnconfigure(0, weight=1)

        # 出库成本
        outbound_frame = ttk.LabelFrame(tab, text="出库成本")
        outbound_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        outbound_tree_frame = ttk.Frame(outbound_frame)
        outbound_tree_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.result_outbound_tree = ttk.Treeview(
            outbound_tree_frame, show="headings", height=8,
            columns=["material", "quantity", "price", "amount"],
            style="Preview.Treeview",
        )
        self.result_outbound_tree.heading("material", text="物料名称")
        self.result_outbound_tree.heading("quantity", text="出库数量")
        self.result_outbound_tree.heading("price", text="单价")
        self.result_outbound_tree.heading("amount", text="出库金额")
        self.result_outbound_tree.column("material", width=200, anchor=tk.W)
        self.result_outbound_tree.column("quantity", width=100, anchor=tk.E)
        self.result_outbound_tree.column("price", width=100, anchor=tk.E)
        self.result_outbound_tree.column("amount", width=120, anchor=tk.E)
        self.result_outbound_tree.tag_configure("warning", background="#FFFF00")
        self.result_outbound_tree.tag_configure("even", background="#F5F5F5")
        self.result_outbound_tree.tag_configure("odd", background="white")

        y_scroll = ttk.Scrollbar(outbound_tree_frame, orient=tk.VERTICAL,
                                  command=self.result_outbound_tree.yview)
        self.result_outbound_tree.configure(yscrollcommand=y_scroll.set)
        self.result_outbound_tree.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        outbound_tree_frame.grid_rowconfigure(0, weight=1)
        outbound_tree_frame.grid_columnconfigure(0, weight=1)

        # 警告信息
        self.result_warning_label = ttk.Label(tab, text="", foreground="red",
                                               wraplength=900, justify=tk.LEFT)
        self.result_warning_label.pack(fill=tk.X, padx=5)

        # 导出按钮
        btn_frame = ttk.Frame(tab)
        btn_frame.pack(fill=tk.X, padx=5, pady=5)
        ttk.Button(btn_frame, text="导出结果", command=self._on_export).pack(side=tk.RIGHT, padx=10)

    # ---- 事件处理 ----

    def _on_tab_changed(self, event):
        """处理 tab 切换事件"""
        current_tab = self.notebook.index(self.notebook.select())
        # tab 0=入库记录, 1=期初库存, 2=出库记录, 3=计算结果
        if current_tab == 0:  # 入库记录
            if self.state.calc_result is not None and self.batch_frame is not None:
                self.batch_frame.pack(fill=tk.BOTH, padx=5, pady=5, before=self.stats_labels[InputSource.INBOUND].master)

    def _on_file_selected(self, source: InputSource):
        """处理文件选择事件"""
        file_path = filedialog.askopenfilename(
            title=f"选择{source.value}文件",
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        logger.info(f"用户选择文件: {source.value} -> {file_path}")

        if self.handlers[source] is not None:
            self.handlers[source].close()

        entry = getattr(self, f"file_entry_{source.name}")
        entry.delete(0, tk.END)
        entry.insert(0, file_path)

        try:
            handler = ExcelHandler(file_path)
            sheets = handler.get_sheet_names()
            self.handlers[source] = handler
        except Exception as e:
            messagebox.showerror("错误", f"读取文件失败: {e}")
            return

        combo = self.sheet_combos[source]
        combo["values"] = sheets
        combo.set("")

        state = self.state.sources[source]
        state.file_path = file_path
        state.sheet_name = None
        state.sheet_columns = []
        state.raw_data = []
        state.column_mapping = {}
        state.preview_data = []
        state.stats = {}
        state.anomalies = []

    def _on_sheet_selected(self, source: InputSource):
        """处理 sheet 选择事件"""
        combo = self.sheet_combos[source]
        sheet_name = combo.get()
        if not sheet_name:
            return

        logger.info(f"用户选择 sheet: {source.value} -> {sheet_name}")

        state = self.state.sources[source]
        state.sheet_name = sheet_name
        self._read_range_settings(source)
        self._reload_sheet_data(source)

    def _read_range_settings(self, source: InputSource):
        """从 UI 读取行范围设置"""
        state = self.state.sources[source]
        try:
            state.header_row = int(self.header_row_spins[source].get())
        except (ValueError, tk.TclError):
            state.header_row = 1
        try:
            state.last_row = int(self.last_row_spins[source].get())
        except (ValueError, tk.TclError):
            state.last_row = 0

    def _compute_skip_params(self, source: InputSource) -> tuple[int, int]:
        """根据 header_row 和 last_row 计算 skip_header_rows 和 skip_footer_rows"""
        state = self.state.sources[source]
        total = self.total_excel_rows.get(source, 0)
        skip_header = max(0, state.header_row - 1)  # 标题行之前的行数
        if state.last_row > 0 and total > 0:
            skip_footer = max(0, total - state.last_row)
        else:
            skip_footer = 0
        return skip_header, skip_footer

    def _reload_sheet_data(self, source: InputSource):
        """重新读取 sheet 数据（应用行范围设置）"""
        state = self.state.sources[source]
        handler = self.handlers[source]
        if handler is None or not state.sheet_name:
            return

        # 先用 skip=0 读取一次以获取 total_rows
        try:
            columns_0, data_0, total_rows = handler.read_sheet(state.sheet_name)
        except Exception as e:
            messagebox.showerror("错误", f"读取 Sheet 失败: {e}")
            return
        self.total_excel_rows[source] = total_rows

        # 更新 last_row spinbox 的范围
        self.last_row_spins[source].config(to=total_rows)

        # 计算实际 skip 参数
        skip_header, skip_footer = self._compute_skip_params(source)

        if skip_header == 0 and skip_footer == 0:
            columns, data = columns_0, data_0
        else:
            try:
                columns, data, _ = handler.read_sheet(
                    state.sheet_name,
                    skip_header_rows=skip_header,
                    skip_footer_rows=skip_footer,
                )
            except Exception as e:
                messagebox.showerror("错误", f"读取 Sheet 失败: {e}")
                return

        state.sheet_columns = columns
        state.raw_data = data

        mapping = self.mapper.auto_match(columns, source)
        state.column_mapping = mapping

        self._update_mapping_combos(source, columns, mapping)
        self._update_row_range_label(source)
        self._refresh_preview(source)

    def _on_range_changed(self, source: InputSource):
        """处理行范围设置变更"""
        state = self.state.sources[source]
        old_header = state.header_row
        old_last = state.last_row
        self._read_range_settings(source)
        self._update_row_range_label(source)

        if (state.header_row != old_header or state.last_row != old_last) and state.sheet_name:
            logger.info(f"用户修改行范围: {source.value} -> 标题行={state.header_row}, 末尾行={state.last_row}")
            self._reload_sheet_data(source)

    def _update_row_range_label(self, source: InputSource):
        """更新行范围提示标签"""
        state = self.state.sources[source]
        label = self.row_range_labels[source]
        total = self.total_excel_rows.get(source, 0)

        if total == 0 or not state.sheet_name:
            label.config(text="")
            return

        data_start = state.header_row + 1  # 数据从标题行下一行开始
        data_end = state.last_row if state.last_row > 0 else total
        data_count = max(0, data_end - data_start + 1)

        if data_count > 0:
            label.config(text=f"数据: 第{data_start}~{data_end}行 (共{data_count}行)")
        else:
            label.config(text="无有效数据行", foreground="red")

    def _update_mapping_combos(self, source: InputSource, columns: list[str],
                                mapping: dict[str, str | None]):
        """更新列映射下拉框，显示格式: A: 进货日期 / E: (空)"""
        from src.excel_handler import col_letter

        # 生成显示列表：列字母 + 列名
        display_items = []
        self._column_display_to_key[source] = {}
        for i, col in enumerate(columns):
            letter = col_letter(i)
            if col.endswith("列") and len(col) <= 3 and col[0].isalpha():
                # 空标题列，如 "A列"
                display = f"{letter}: (空)"
            else:
                display = f"{letter}: {col}"
            display_items.append(display)
            self._column_display_to_key[source][display] = col

        col_combos = self.mapping_combos.get(source, {})
        for col_key, combo in col_combos.items():
            combo["values"] = ["(未映射)"] + display_items
            matched = mapping.get(col_key)
            if matched:
                # 找到对应的 display 文本
                for disp, key in self._column_display_to_key[source].items():
                    if key == matched:
                        combo.set(disp)
                        break
            else:
                combo.set("(未映射)")

    def _on_mapping_changed(self, source: InputSource):
        """处理列映射修改事件"""
        col_combos = self.mapping_combos.get(source, {})
        mapping: dict[str, str | None] = {}
        for col_key, combo in col_combos.items():
            val = combo.get()
            if val == "(未映射)" or not val:
                mapping[col_key] = None
            else:
                # 从显示文本还原为列名 key
                col_key_name = self._column_display_to_key.get(source, {}).get(val, val)
                mapping[col_key] = col_key_name

        logger.info(f"用户修改列映射: {source.value} -> {mapping}")

        state = self.state.sources[source]
        state.column_mapping = mapping
        self._refresh_preview(source)

    def _refresh_preview(self, source: InputSource):
        """刷新预览数据（全量加载）"""
        state = self.state.sources[source]
        mapping = {k: v for k, v in state.column_mapping.items() if v is not None}

        if not mapping:
            self._clear_preview(source)
            return

        # 全量加载
        state.preview_data = self.analyzer.preview(state.raw_data, mapping, len(state.raw_data))
        state.stats = self.analyzer.get_stats(state.raw_data, mapping)

        row_offset = state.header_row  # 异常行号偏移 = 标题行号
        state.anomalies = self.analyzer.detect_anomalies(
            state.raw_data, mapping, source, row_offset=row_offset
        )

        self._update_tree(source)

        stats_text = f"共 {state.stats.get('total_rows', 0)} 行 | 物料种类: {state.stats.get('material_count', 0)}"
        self.stats_labels[source].config(text=stats_text)

        if state.anomalies:
            anomaly_texts = []
            for a in state.anomalies[:10]:
                anomaly_texts.append(f"第{a.row_index}行 {a.label}")
            text = "⚠ 异常: " + ", ".join(anomaly_texts)
            if len(state.anomalies) > 10:
                text += f" ... 共{len(state.anomalies)}条"
            self.anomaly_labels[source].config(text=text)
        else:
            self.anomaly_labels[source].config(text="")

    def _update_tree(self, source: InputSource):
        """更新 Treeview 数据"""
        tree = self.preview_trees[source]
        state = self.state.sources[source]

        tree.delete(*tree.get_children())

        col_defs = SOURCE_COLUMNS[source]
        mapped_keys = [cd.key for cd in col_defs if state.column_mapping.get(cd.key) is not None]

        tree["columns"] = ["_row_num"] + mapped_keys
        tree.heading("_row_num", text="行号")
        tree.column("_row_num", width=50, anchor=tk.CENTER, stretch=False)

        display_names = []
        for key in mapped_keys:
            for cd in col_defs:
                if cd.key == key:
                    display_names.append(cd.display)
                    break

        for key, display in zip(mapped_keys, display_names):
            tree.heading(key, text=display)
            tree.column(key, width=100, anchor=tk.CENTER)

        row_offset = state.header_row + 1  # 数据行号 = 标题行 + 1 + 索引

        # 构建异常行号集合
        anomaly_rows = {a.row_index for a in state.anomalies}

        for i, row_data in enumerate(state.preview_data):
            excel_row = row_offset + i
            values = [excel_row] + [row_data.get(key, "") for key in mapped_keys]
            if excel_row in anomaly_rows:
                tag = "anomaly"
            elif i % 2 == 0:
                tag = "even"
            else:
                tag = "odd"
            tree.insert("", tk.END, values=values, tags=(tag,))

    def _clear_preview(self, source: InputSource):
        """清除预览"""
        tree = self.preview_trees[source]
        tree.delete(*tree.get_children())
        tree["columns"] = []
        self.stats_labels[source].config(text="")
        self.anomaly_labels[source].config(text="")

    def _on_start_calc(self):
        """点击开始计算"""
        logger.info("用户点击开始计算")

        missing = []
        for source in InputSource:
            state = self.state.sources[source]
            if not state.file_path:
                missing.append(f"{source.value}: 未选择文件")
            elif not state.sheet_name:
                missing.append(f"{source.value}: 未选择Sheet")

        if missing:
            messagebox.showwarning("提示", "请完成以下操作:\n" + "\n".join(missing))
            return

        all_missing_cols = []
        for source in InputSource:
            state = self.state.sources[source]
            missing_cols = self.mapper.validate_mapping(state.column_mapping, source)
            if missing_cols:
                all_missing_cols.append(f"{source.value}: 缺少列映射 {', '.join(missing_cols)}")

        if all_missing_cols:
            messagebox.showwarning("提示", "请完成以下列映射:\n" + "\n".join(all_missing_cols))
            return

        # 准备映射后数据
        try:
            opening_data = self._get_mapped_data(InputSource.OPENING)
            inbound_data = self._get_mapped_data(InputSource.INBOUND)
            outbound_data = self._get_mapped_data(InputSource.OUTBOUND)
        except Exception as e:
            logger.error(f"计算失败: {e}")
            messagebox.showerror("错误", f"数据准备失败: {e}")
            return

        # 执行 FIFO 计算
        try:
            result = self.engine.calculate(opening_data, inbound_data, outbound_data)
            self.state.calc_result = result
        except Exception as e:
            logger.error(f"计算失败: {e}")
            messagebox.showerror("错误", f"计算失败: {e}")
            return

        # 更新结果 tab
        self._update_result_tab(result)

        # 更新入库 TAB 批次明细
        self._update_batch_detail(result)

        # 切换到计算结果 tab
        self.notebook.select(self.result_tab)

    def _get_mapped_data(self, source: InputSource) -> list[dict]:
        """获取映射后的数据（key 为 column_key）"""
        state = self.state.sources[source]
        mapping = {k: v for k, v in state.column_mapping.items() if v is not None}

        mapped_data = []
        for row in state.raw_data:
            mapped_row = {}
            for col_key, sheet_col in mapping.items():
                mapped_row[col_key] = row.get(sheet_col)
            mapped_data.append(mapped_row)
        return mapped_data

    def _update_result_tab(self, result: CalcResult):
        """更新计算结果 tab 的数据"""
        # 期末库存表
        tree = self.result_closing_tree
        tree.delete(*tree.get_children())

        for i, m in enumerate(result.materials):
            tag = "warning" if m.warnings else ("even" if i % 2 == 0 else "odd")
            tree.insert("", tk.END, values=(
                m.material_name,
                f"{m.closing_quantity:.2f}",
                f"{m.closing_avg_price:.2f}",
                f"{m.closing_amount:.2f}",
            ), tags=(tag,))

        # 出库成本表
        tree = self.result_outbound_tree
        tree.delete(*tree.get_children())

        for i, m in enumerate(result.materials):
            tag = "warning" if m.warnings else ("even" if i % 2 == 0 else "odd")
            tree.insert("", tk.END, values=(
                m.material_name,
                f"{m.outbound_quantity:.2f}",
                f"{m.outbound_avg_price:.2f}",
                f"{m.outbound_amount:.2f}",
            ), tags=(tag,))

        # 警告信息
        if result.has_warnings:
            warn_texts = []
            for m in result.materials:
                for w in m.warnings:
                    warn_texts.append(w)
            self.result_warning_label.config(text="⚠ " + "; ".join(warn_texts))
        else:
            self.result_warning_label.config(text="")

    def _update_batch_detail(self, result: CalcResult):
        """更新入库 TAB 的批次明细区域"""
        if self.batch_frame is None:
            return

        # 显示批次明细区域
        self.batch_frame.pack(fill=tk.BOTH, padx=5, pady=5,
                              before=self.stats_labels[InputSource.INBOUND].master)

        # 填充物料下拉框
        material_names = [m.material_name for m in result.materials]
        self.batch_material_combo["values"] = material_names
        if material_names:
            self.batch_material_combo.set(material_names[0])
            self._show_batch_for_material(material_names[0])

    def _on_batch_material_selected(self, event):
        """处理批次明细物料选择"""
        material_name = self.batch_material_combo.get()
        if material_name:
            self._show_batch_for_material(material_name)

    def _show_batch_for_material(self, material_name: str):
        """显示指定物料的批次明细"""
        result = self.state.calc_result
        if result is None:
            return

        mat = next((m for m in result.materials if m.material_name == material_name), None)
        if mat is None:
            return

        tree = self.batch_tree
        tree.delete(*tree.get_children())

        for i, batch in enumerate(mat.batches):
            date_display = batch.source_date if batch.source_date else "-"
            tag = "consumed" if batch.consumed_qty > 0 and batch.quantity == 0 else ("even" if i % 2 == 0 else "odd")
            tree.insert("", tk.END, values=(
                batch.source_type,
                date_display,
                f"{batch.original_qty:.2f}",
                f"{batch.consumed_qty:.2f}",
                f"{batch.quantity:.2f}",
                f"{batch.unit_price:.2f}",
            ), tags=(tag,))

        # 汇总
        self.batch_summary_label.config(
            text=f"出库合计: {mat.outbound_quantity:.2f}  出库成本: {mat.outbound_amount:.2f}  期末结余: {mat.closing_quantity:.2f}"
        )

    def _on_export(self):
        """导出结果"""
        if self.state.calc_result is None:
            messagebox.showwarning("提示", "请先执行计算")
            return

        default_name = f"汇算结果_{datetime.now().strftime('%Y%m%d')}.xlsx"
        file_path = filedialog.asksaveasfilename(
            title="导出计算结果",
            defaultextension=".xlsx",
            initialfile=default_name,
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        logger.info(f"用户导出结果到: {file_path}")

        try:
            self.exporter.export(self.state.calc_result, file_path)
            messagebox.showinfo("成功", f"结果已导出到:\n{file_path}")
        except Exception as e:
            logger.error(f"导出失败: {e}")
            messagebox.showerror("错误", f"导出失败: {e}")


def setup_logger():
    """配置日志"""
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    log_dir = os.path.join(base_dir, "logs")
    os.makedirs(log_dir, exist_ok=True)

    logger = logging.getLogger("monthly_settlement")
    logger.setLevel(logging.DEBUG)

    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s.%(funcName)s:%(lineno)d - %(message)s"
    ))

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s"
    ))

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)


def main():
    """主程序入口"""
    setup_logger()
    logger.info("月度汇算小工具启动")

    root = tk.Tk()
    app = MonthlySettlementApp(root)

    def on_closing():
        for source in InputSource:
            handler = app.handlers[source]
            if handler is not None:
                handler.close()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()


if __name__ == "__main__":
    main()
