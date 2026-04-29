import { NextRequest, NextResponse } from "next/server";
import { verifyRequestToken } from "@/app/lib/submission-validation";
import { moveGroupFolder }    from "@/app/lib/googledrive-folder";

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyRequestToken(req);
    if (!caller) {
      return NextResponse.json({ error: "Kimlik doğrulaması gerekli." }, { status: 401 });
    }
    if (caller.role === "student") {
      return NextResponse.json({ error: "Yetki yetersiz." }, { status: 403 });
    }

    const { groupName, action } = await req.json() as {
      groupName: string;
      action:    "archive" | "restore";
    };

    if (!groupName || (action !== "archive" && action !== "restore")) {
      return NextResponse.json({ error: "groupName ve action (archive|restore) zorunludur." }, { status: 400 });
    }

    await moveGroupFolder(groupName, action);
    return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[groups/drive-folder]", detail);
    return NextResponse.json({ error: "Drive klasör taşıma başarısız.", detail }, { status: 500 });
  }
}
