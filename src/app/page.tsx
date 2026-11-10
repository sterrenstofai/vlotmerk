import type { Metadata } from "next";
import { PRODUCT } from "@/lib/config/product";
import Landing from "./_landing/landing";
import { AuthReturn } from "./_landing/auth-return";

export const metadata: Metadata = {
  title: { absolute: `${PRODUCT.naam}: je merk veilig en snel vastgelegd` },
  description:
    "Vul je merknaam in en zie of hij onderscheidend is, botst met bestaande merken en in welke klassen hij hoort. Een risico-indicatie, geen garantie.",
};

export default function Home() {
  return (
    <>
      <AuthReturn />
      <Landing />
    </>
  );
}
