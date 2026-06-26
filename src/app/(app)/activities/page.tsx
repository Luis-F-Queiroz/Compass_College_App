import EntityScreen from "@/components/EntityScreen";
import CommonAppExport from "@/components/CommonAppExport";
export default function Page() {
  return <EntityScreen entity="activities" toolbarExtra={<CommonAppExport />} />;
}
