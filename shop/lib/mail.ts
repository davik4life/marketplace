import { required, config } from "./server";
export async function sendMail(input: { to: string; subject: string; text: string; html: string; messageId: string }) {
  const region = config("MAILGUN_REGION") || "US";
  if (!["US", "EU"].includes(region)) throw Error("Invalid Mailgun region");
  const domain = required("MAILGUN_DOMAIN");
  const form = new FormData();
  form.set("from", required("MAILGUN_FROM"));
  form.set("to", input.to);
  form.set("subject", input.subject);
  form.set("text", input.text);
  form.set("html", input.html);
  form.set("h:Message-Id", `<${input.messageId}@${domain}>`);
  const response = await fetch(`https://${region === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net"}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST", headers: { Authorization: "Basic " + btoa("api:" + required("MAILGUN_API_KEY")) },
    body: form, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`Mailgun rejected message (${response.status})`);
  const result = await response.json() as { id: string };
  return result.id;
}
