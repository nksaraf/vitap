import React from "react";

export default function App({ children }) {
  return (
    <html>
      <head></head>
      <body>
        SSR yooo!
        {children}
      </body>
    </html>
  );
}
