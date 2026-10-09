<?php
namespace App\Services;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
class OrderEmails
{
  public static function record(object $order, string $event): void
  {
    if (!config('mail.order_enabled')) {
      return;
    }
    // Customer updates go to the account owner, never an unverified checkout address.
    $email = DB::table('users')->where('id', $order->user_id)->value('email');
    $admins = config('mail.store_address')
      ? [config('mail.store_address')]
      : DB::table('users')->where('role', 'admin')->pluck('email')->all();
    $recipients = [$email, ...$admins];
    $subject = 'Kipi POS · Order #' . $order->id . ' — ' . $event;
    $body =
      $subject .
      "\nStatus: " .
      $order->status .
      "\nTotal: MMK " .
      number_format($order->total_cents / 100, 2);
    $body .=
      "\nCustomer: " .
      $order->customer_name .
      "\nOrder type: " .
      str_replace('_', ' ', $order->service_type);
    if ($event === 'Customer confirmed order') {
      $body .= "\nCustomer confirmation received. Waiting for the store to accept the order.";
    }
    if ($event === 'Order confirmed') {
      $body .=
        "\nYour order is confirmed! Kipi POS has accepted your order and is preparing your items. We will notify you when your order is ready.";
    }
    if ($event === 'Order ready') {
      $body .= "\nYour order is ready. Open your order for pickup or delivery details.";
    }
    if ($event === 'Delivery assigned') {
      $body .= "\nA driver has been assigned to your takeaway order.";
    }
    if ($event === 'Delivery is coming') {
      $body .= "\nYour delivery is coming. The driver is on the way.";
      if ($order->driver_name) {
        $body .= "\nDriver: " . $order->driver_name;
      }
      if ($order->driver_phone) {
        $body .= "\nDriver phone: " . $order->driver_phone;
      }
      if ($order->delivery_location) {
        $body .= "\nDelivering to: " . $order->delivery_location;
      }
      if ($order->delivery_eta) {
        $body .= "\nEstimated arrival: " . $order->delivery_eta;
      }
    }
    if ($event === 'Order delivered') {
      $body .= "\nYour order has arrived. The store will record payment and provide your receipt.";
    }
    foreach ($order->items as $item) {
      $body .=
        "\n" . $item->quantity . ' × ' . $item->name . ' · ' . ucfirst($item->size ?? 'medium');
    }
    if ($order->delivery_status) {
      $body .= "\nDelivery: " . str_replace('_', ' ', $order->delivery_status);
    }
    $body .=
      "\nOpen your order: " . config('mail.store_url') . "\nSign in and open Orders for details.";
    foreach (array_unique(array_filter($recipients)) as $recipient) {
      if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        continue;
      }
      $customerSubjects = [
        'Order confirmed' => 'Kipi POS · Your order #' . $order->id . ' is confirmed',
        'Delivery assigned' => 'Kipi POS · Driver assigned for order #' . $order->id,
        'Delivery is coming' => 'Kipi POS · Your order #' . $order->id . ' delivery is coming',
        'Order delivered' => 'Kipi POS · Your order #' . $order->id . ' was delivered',
      ];
      $recipientSubject = $recipient === $email ? $customerSubjects[$event] ?? $subject : $subject;
      $recipientBody =
        $recipient === $email
          ? 'Hello ' .
            $order->customer_name .
            ",\n\n" .
            $body .
            "\n\nThank you for ordering with Kipi POS!"
          : $body;
      DB::table('order_emails')->insert([
        'order_id' => $order->id,
        'recipient' => $recipient,
        'subject' => $recipientSubject,
        'body' => $recipientBody,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
    }
  }
  public static function sendPending(): array
  {
    if (!config('mail.order_enabled') || config('mail.default') !== 'smtp') {
      return ['sent' => 0, 'failed' => 0];
    }
    $sent = 0;
    $failed = 0;
    foreach (
      DB::table('order_emails')
        ->whereNull('sent_at')
        ->where('attempts', '<', 5)
        ->orderBy('id')
        ->limit(50)
        ->get()
      as $email
    ) {
      try {
        Mail::raw(
          $email->body,
          fn($message) => $message->to($email->recipient)->subject($email->subject),
        );
        DB::table('order_emails')
          ->where('id', $email->id)
          ->update(['sent_at' => now(), 'attempts' => $email->attempts + 1, 'updated_at' => now()]);
        $sent++;
      } catch (\Throwable $e) {
        DB::table('order_emails')
          ->where('id', $email->id)
          ->update(['attempts' => $email->attempts + 1, 'updated_at' => now()]);
        $failed++;
        report($e);
      }
    }
    return compact('sent', 'failed');
  }
}
