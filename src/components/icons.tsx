export function Icon({ name }: { name: "home" | "students" | "fees" | "feeding" | "messages" | "settings" | "schools" | "broadcast" }) {
  const paths: Record<typeof name, string> = {
    home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
    students: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4m2-6c2.2.2 3.8 1.6 4.2 4",
    fees: "M6 6h12v12H6zM9 10h6M9 14h4",
    feeding: "M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm2-3c0-2 1.5-3 4-3s4 1 4 3",
    messages: "M5 6h14v9H8l-3 3z",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM4 12h2m12 0h2M12 4v2m0 12v2M6.2 6.2l1.4 1.4m8.8 8.8 1.4 1.4m0-11.6-1.4 1.4M7.6 16.4l-1.4 1.4",
    schools: "M4 20V8l8-4 8 4v12M9 20v-6h6v6",
    broadcast: "M5 10v4m4-6v8m4-10v12m4-9v6",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
