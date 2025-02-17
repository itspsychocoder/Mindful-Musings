import { buffer } from 'micro';
import Stripe from 'stripe';
import User from '@/models/User';
import connectDB from '@/middlewares/connectDB';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const buf = await buffer(req); // Ensuring raw body is passed
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'invoice.payment_succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded for subscription:', paymentIntent);
      // Handle successful payment, such as updating user status in your database
      const customerId = paymentIntent.customer;

      // Optionally, if you want to retrieve the customer data (e.g., email), you'll need to fetch it
      let transactionId = event.data.object.subscription;
      const customer = await stripe.customers.retrieve(customerId);
      let subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth()+1);
      // Now you can access the customer's email
      const customerEmail = customer.email;
      console.log(customerEmail);
      const result = await User.findOneAndUpdate(
        { email: customerEmail }, // Search by email
        { $set: { isPremium: true, subscriptionStartDate: new Date(), paymentMethod: "stripe", subscriptionEndDate: subscriptionEndDate, transactionId: transactionId } }, // Update subscription details
        { returnOriginal: false } // Return the updated document
      );
      break;
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log('Payment failed:', failedInvoice);
      // Handle failed payment, notify the user, etc.
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
}
