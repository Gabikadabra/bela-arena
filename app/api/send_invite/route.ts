import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      partnerEmail,
      captainName,
      teamName,
      tournamentName
    } = body;

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    const { error } = await resend.emails.send({
      from: "Bela Arena <onboarding@resend.dev>",
      to: partnerEmail,
      subject: `${captainName} te poziva u Bela Arena ekipu`,
      html: `
        <div style="background:#050505;padding:40px;font-family:Arial,sans-serif;color:white;">
          <div style="max-width:600px;margin:auto;background:#111;border:1px solid #333;border-radius:20px;padding:35px;">
            <h1 style="color:#facc15;margin:0 0 20px;">
              🎴 Bela Arena
            </h1>

            <h2 style="margin-bottom:20px;">
              Poziv u ekipu
            </h2>

            <p style="font-size:16px;color:#ddd;">
              <b>${captainName}</b> te želi dodati u ekipu
              <b>${teamName}</b>.
            </p>

            <p style="font-size:16px;color:#ddd;">
              Turnir: <b>${tournamentName}</b>
            </p>

            <a href="${inviteLink}"
               style="display:inline-block;margin-top:25px;background:#facc15;color:#000;
                      padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">
              Prihvati poziv
            </a>

            <p style="margin-top:30px;color:#777;font-size:13px;">
              Ako ovo nisi očekivao, ignoriraj email.
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}