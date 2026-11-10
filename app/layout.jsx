   export const metadata = { title: "Asisten AI" };

   export default function RootLayout({ children }) {
     return (
       <html lang="id">
         <body style={{ margin: 0 }}>{children}</body>
       </html>
     );
   }