import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Editor } from "@/components/admin/Editor";
import { isAdmin, usingDefaultPassword } from "@/lib/auth";
import { getCmsDoc } from "@/lib/cms/store";
import { landingContext } from "@/lib/landing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const doc = await getCmsDoc();
  return (
    <Editor
      initialDraft={doc.draft}
      initialPublished={doc.published}
      publishedAt={doc.publishedAt}
      history={doc.history}
      ctx={landingContext()}
      defaultPassword={usingDefaultPassword()}
    />
  );
}
