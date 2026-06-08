"""config.py 测试"""

import pytest

from src.config import (
    PREVIEW_DEFAULT_ROWS,
    SOURCE_COLUMNS,
    InputSource,
)


@pytest.mark.unit
class TestConfig:
    """配置正确性测试"""

    def test_cfg_001_required_columns_have_aliases(self):
        """CFG-001: 每个来源的 required 列都有 aliases"""
        for source, col_defs in SOURCE_COLUMNS.items():
            for col_def in col_defs:
                if col_def.required:
                    assert len(col_def.aliases) > 0, (
                        f"{source.value} 的必需列 {col_def.key} aliases 为空"
                    )

    def test_cfg_002_no_duplicate_keys_within_source(self):
        """CFG-002: 同一来源的 column key 不重复"""
        for source, col_defs in SOURCE_COLUMNS.items():
            keys = [cd.key for cd in col_defs]
            assert len(keys) == len(set(keys)), (
                f"{source.value} 存在重复的 column key"
            )

    def test_cfg_003_preview_default_rows_positive(self):
        """CFG-003: PREVIEW_DEFAULT_ROWS 为正整数"""
        assert isinstance(PREVIEW_DEFAULT_ROWS, int)
        assert PREVIEW_DEFAULT_ROWS > 0
