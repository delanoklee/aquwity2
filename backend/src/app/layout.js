export const metadata = {
  title: 'Acuity API',
  description: 'Backend for Acuity focus app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
