export default function LoadingModal() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="flex items-center space-x-4 rounded-xl bg-white p-6 shadow-lg">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-t-transparent"></div>
                <h1 className="text-xl font-bold text-gray-700">Carregando...</h1>
            </div>
        </div>
    )
}