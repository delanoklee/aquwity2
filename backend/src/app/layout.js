export const metadata = {
  title: 'Aquwity API',
  description: 'Backend for Aquwity focus app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
