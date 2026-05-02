import { useState } from "react";
import { TrustProvider } from "./context/TrustContext";
import Layout from "./components/Layout";
import PlaceholderPage from "./pages/PlaceholderPage";
import TenantsPage from "./pages/TenantsPage";
import RentEntryPage from "./pages/RentEntryPage";
import MajlisBillsPage from "./pages/MajlisBillsPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import VouchersPage from "./pages/VouchersPage";
import ReceivablesPage from "./pages/ReceivablesPage";
import JournalEntriesPage from "./pages/JournalEntriesPage";
import CashPositionPage from "./pages/CashPositionPage";
import ImportExcelPage from "./pages/ImportExcelPage";
import ExportReportsPage from "./pages/ExportReportsPage";

const PAGE_LABELS = {
  "rent-entry": "Rent Entry",
  tenants: "Tenants",
  "majlis-bills": "Majlis Bills",
  vouchers: "Vouchers",
  "journal-entries": "Journal Entries",
  investments: "Investments",
  "cash-position": "Cash Position",
  receivables: "Receivables",
  "import-excel": "Import Excel",
  "export-reports": "Export Reports",
};

function PageRouter({ activePage }) {
  switch (activePage) {
    case "tenants":
      return <TenantsPage />;
    case "rent-entry":
      return <RentEntryPage />;
    case "majlis-bills":
      return <MajlisBillsPage />;
    case "investments":
      return <InvestmentsPage />;
    case "vouchers":
      return <VouchersPage />;
    case "receivables":
      return <ReceivablesPage />;
    case "journal-entries":
      return <JournalEntriesPage />;
    case "cash-position":
      return <CashPositionPage />;
    case "import-excel":
      return <ImportExcelPage />;
    case "export-reports":
      return <ExportReportsPage />;
    default:
      return <PlaceholderPage title={PAGE_LABELS[activePage] ?? "Dashboard"} />;
  }
}

function App() {
  const [activePage, setActivePage] = useState("rent-entry");

  return (
    <TrustProvider>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        <PageRouter activePage={activePage} />
      </Layout>
    </TrustProvider>
  );
}

export default App;
