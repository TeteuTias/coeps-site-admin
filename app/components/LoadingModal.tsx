interface LoadingModalProps {
  isLoading: boolean
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isLoading }) => {
  if (!isLoading) {
    return null
  }

  return (
    <div className="loading-modal-overlay" role="status" aria-live="polite">
      <div className="loading-modal-card">
        <span className="loading-modal-mark">CIEPS</span>
        <span className="loading-modal-text">Carregando</span>
      </div>
    </div>
  )
}

export default LoadingModal
