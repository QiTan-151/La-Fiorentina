import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // chưa cấu hình email -> bỏ qua, không làm crash server
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

export async function sendReservationEmails(reservation) {
  const t = getTransporter();
  if (!t) {
    console.warn('⚠️  Email chưa được cấu hình (.env) — bỏ qua gửi email cho đơn #' + reservation.id);
    return;
  }

  const { id, name, phone, email, reservation_date, reservation_time, party_size, note } = reservation;

  // Email báo cho nhà hàng
  await t.sendMail({
    from: `"La Fiorentina Website" <${process.env.SMTP_USER}>`,
    to: process.env.RESTAURANT_EMAIL || process.env.SMTP_USER,
    subject: `🍝 Đơn đặt bàn mới #${id} - ${name}`,
    text: [
      'Có đơn đặt bàn mới từ website:',
      '',
      `Tên khách: ${name}`,
      `Điện thoại: ${phone}`,
      `Email: ${email || 'không có'}`,
      `Ngày: ${reservation_date}`,
      `Giờ: ${reservation_time}`,
      `Số khách: ${party_size}`,
      `Ghi chú: ${note || 'không có'}`,
      '',
      'Vui lòng xác nhận qua trang quản lý hoặc gọi lại cho khách.'
    ].join('\n')
  });

  // Email xác nhận cho khách (chỉ gửi nếu khách có điền email)
  if (email) {
    await t.sendMail({
      from: `"La Fiorentina" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Xác nhận yêu cầu đặt bàn - La Fiorentina',
      text: [
        `Xin chào ${name},`,
        '',
        'Cảm ơn bạn đã đặt bàn tại La Fiorentina. Chúng tôi đã nhận được yêu cầu:',
        '',
        `Ngày: ${reservation_date}`,
        `Giờ: ${reservation_time}`,
        `Số khách: ${party_size}`,
        '',
        `Nhà hàng sẽ liên hệ số điện thoại ${phone} để xác nhận trong thời gian sớm nhất.`,
        '',
        'Trân trọng,',
        'La Fiorentina - 54 P. Quảng An, Tây Hồ, Hà Nội',
        'Hotline: +84 936 302 868'
      ].join('\n')
    });
  }
}
