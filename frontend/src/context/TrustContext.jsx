import { createContext, useContext, useState, useEffect } from "react";

const TrustContext = createContext(null);

const FALLBACK_TRUSTS = [
  { id: 1, name: "Hussaini Vakil Hussain Trust", code: "HVHT" },
  { id: 2, name: "Bait-ul-Ilm Burhani", code: "BIB" },
  { id: 3, name: "Husami Tahir Taheri Trust", code: "HTTT" },
];

export function TrustProvider({ children }) {
  const [trusts, setTrusts] = useState(FALLBACK_TRUSTS);
  const [selectedTrust, setSelectedTrust] = useState(FALLBACK_TRUSTS[0]);
  const [currentDate, setCurrentDate] = useState({
    gregorian_formatted: "",
    hijri_formatted: null,
  });

  useEffect(() => {
    fetchTrusts();
    fetchCurrentDate();
  }, []);

  async function fetchTrusts() {
    try {
      const res = await fetch("http://localhost:8000/api/trusts");
      if (!res.ok) return;
      const data = await res.json();
      setTrusts(data);
      setSelectedTrust(data[0]);
    } catch {
      // backend not running — use fallback
    }
  }

  async function fetchCurrentDate() {
    try {
      const res = await fetch("http://localhost:8000/api/current-date");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentDate(data);
    } catch {
      const today = new Date();
      setCurrentDate({
        gregorian_formatted: today.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        hijri_formatted: null,
      });
    }
  }

  return (
    <TrustContext.Provider
      value={{ trusts, selectedTrust, setSelectedTrust, currentDate }}
    >
      {children}
    </TrustContext.Provider>
  );
}

export function useTrust() {
  return useContext(TrustContext);
}
