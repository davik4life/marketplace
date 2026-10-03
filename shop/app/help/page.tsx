export default function Help() {
  return <main className="help-page">
    <a className="back" href="/#collection">← Back to the collection</a>
    <p className="eyebrow">THE HELPFUL DETAILS</p>
    <h1>A little help, right here.</h1>
    <section id="delivery"><h2>Delivery, with care.</h2><p>Our checkout is set up for addresses within Nigeria. Delivery is ₦2,500, or free when your product subtotal reaches ₦75,000.</p><p>Okirika is currently in test mode. The collection is illustrative, and test orders do not result in real charges or shipments. Delivery dates and returns arrangements will be available before real purchases open.</p></section>
    <section id="payments"><h2>A secure finishing touch.</h2><p>Add your favourites to your bag, sign in with Google, and enter your delivery details. You’ll complete payment in a secure Paystack window on this page using its test payment options.</p><p>An order is only marked paid after the payment is verified. If you leave checkout early, visit <a href="/orders">your orders</a> to continue an initialized payment or check its status.</p></section>
    <section id="orders"><h2>Your good things, all together.</h2><p>Find your order history and payment status in <a href="/orders">your account</a>. We send a confirmation to the email address on your Google account after a successful payment. Test orders can send real confirmation emails.</p><p>If your confirmation is pending, check your order page for the option to retry the email. Check your spam folder too.</p></section>
    <section id="privacy"><h2>Your account, thoughtfully handled.</h2><p>Google sign-in provides your name and email for your account and order confirmations. Your bag, delivery details, and orders are saved in our database. Essential cookies keep you signed in and remember your bag.</p><p>Payments are completed with Paystack; card details are not collected by the shop. Confirmation emails are sent through Mailgun. You can sign out using the link at the top of the page.</p></section>
  </main>;
}
