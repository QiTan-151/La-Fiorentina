export async function notifyTelegram(reservation) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️  Telegram chưa được cấu hình (.env) — bỏ qua thông báo cho đơn #' + reservation.id);
    return;
  }

  const { id, name, phone, reservation_date, reservation_time, party_size, note } = reservation;

  const text = [
    `🍝 *Đơn đặt bàn mới #${id}*`,
    `👤 ${name}`,
    `📞 ${phone}`,
    `📅 ${reservation_date} lúc ${reservation_time}`,
    `👥 ${party_size} khách`,
    `📝 ${note || 'không có ghi chú'}`
  ].join('\n');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });

  if (!res.ok) {
    console.error('Telegram notify failed:', await res.text());
  }
}
