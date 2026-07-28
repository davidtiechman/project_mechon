const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse">
      <div className="aspect-[11/14] w-full bg-black/[0.04]" />
      <div className="mt-4 flex justify-between text-base-regular">
        <div className="w-2/5 h-6 bg-gray-100"></div>
        <div className="w-1/5 h-6 bg-gray-100"></div>
      </div>
    </div>
  )
}

export default SkeletonProductPreview
