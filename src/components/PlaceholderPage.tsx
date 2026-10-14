interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
      <div className="w-16 h-16 rounded-full bg-[#00828A]/10 flex items-center justify-center mb-4">
        <span className="text-2xl text-[#00828A] font-light">{title.charAt(0)}</span>
      </div>
      <h1 className="text-2xl font-light text-gray-700 mb-2">{title} Page</h1>
      <p className="text-sm text-gray-400">This section is under construction.</p>
    </div>
  );
}
