"use client";
export async function openInlinePayment(accessCode: string): Promise<boolean> {
  if (!accessCode) throw Error("This payment session is unavailable. Please check your orders.");
  const { default: Paystack } = await import("@paystack/inline-js");
  return new Promise((resolve, reject) => {
    const popup = new Paystack();
    popup.resumeTransaction(accessCode, {
      onSuccess: () => resolve(true),
      onCancel: () => resolve(false),
      onError: () => reject(Error("Paystack could not open. Please check your connection and try again.")),
    });
  });
}
