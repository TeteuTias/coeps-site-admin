interface LoadingModalProps {
    isLoading: boolean;
}


const LoadingModal: React.FC<LoadingModalProps> = ({ isLoading }) => {
    return (
        <>
            {isLoading && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-[9000000000]">
                    <div className="bg-white p-5 rounded-2xl">
                        <span className="text-black text-2xl font-semibold">C A R R E G A N D O</span>
                    </div>
                </div>
            )}
        </>
    );
};

export default LoadingModal
