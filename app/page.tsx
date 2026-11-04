import Link from "next/link";
import { PageRenderer } from "@/components/cms/PageRenderer";
import { isAdmin } from "@/lib/auth";
import { getCmsDoc } from "@/lib/cms/store";
import { landingContext } from "@/lib/landing";
import { DEFAULT_CONTACT_MESSAGE, whatsappFromEnv } from "@/lib/contact";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const preview = sp.preview === "draft" && (await isAdmin());
  const doc = await getCmsDoc();
  const page = preview ? doc.draft : doc.published;
  return (
    <>
      {preview && (
        <div className="preview-bar">
          Previewing your <b>unpublished draft</b>. Visitors still see the published version.
          <Link href="/admin">Back to editor</Link>
        </div>
      )}
      <PageRenderer page={page} ctx={{ ...(await landingContext()), contact: { whatsapp: whatsappFromEnv(), message: DEFAULT_CONTACT_MESSAGE } }} />
    </>
  );
}
