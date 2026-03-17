export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading editor...</p>
      </div>
    </div>
  );
}
