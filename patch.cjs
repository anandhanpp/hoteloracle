const fs = require('fs');
let bookPage = fs.readFileSync('./src/pages/BookingsPage.tsx', 'utf-8');
bookPage = bookPage.replace(/INPUT_STYLE/g, 'INP');
bookPage = bookPage.replace(/SELECT_STYLE/g, 'SEL');
bookPage = bookPage.replace(/const INP: React\.CSSProperties = /g, 'const INP:React.CSSProperties = ');
bookPage = bookPage.replace(/const SEL: React\.CSSProperties = /g, 'const SEL:React.CSSProperties = ');

// Also form.room_rate is undefined, make sure it falls back to 0
bookPage = bookPage.replace(/form\.room_rate \* 0\.5/g, '(form.room_rate || 0) * 0.5');
bookPage = bookPage.replace(/else lateFee = form\.room_rate;/g, 'else lateFee = form.room_rate || 0;');
bookPage = bookPage.replace(/form\.room_rate > 0/g, '(form.room_rate || 0) > 0');

bookPage = bookPage.replace(/as FormData\["payment_mode"\]\)/g, 'as FormData["payment_mode"] || "Credit Card")');
bookPage = bookPage.replace(/as FormData\["reservation_source"\]\)/g, 'as FormData["reservation_source"] || "Direct")');
bookPage = bookPage.replace(/as FormData\["billing_option"\]\)/g, 'as FormData["billing_option"] || "Guest Account")');

fs.writeFileSync('./src/pages/BookingsPage.tsx', bookPage);
console.log('BookingsPage patched');
