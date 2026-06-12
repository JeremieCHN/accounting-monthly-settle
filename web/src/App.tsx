import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import HelpPage from "@/pages/HelpPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </Router>
  );
}
