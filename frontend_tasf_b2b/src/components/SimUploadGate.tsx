import UploadEnvios from './UploadEnvios'

export type SimUploadGateProps = {
  enviosKey: string | null
  onUploaded: (enviosKey: string) => void
  onReset: () => void
}

export default function SimUploadGate({ enviosKey, onUploaded, onReset }: SimUploadGateProps) {
  if (!enviosKey) {
    return <UploadEnvios onUploaded={onUploaded} />
  }

  return (
    <div className="upload-screen">
      <div className="upload-card">
        <h2>Archivos cargados</h2>
        <p>{`Envios activos: ${enviosKey}`}</p>
        <div className="upload-footer">
          <button className="btn" onClick={onReset}>Cambiar archivos</button>
        </div>
      </div>
    </div>
  )
}
