import { useMemo, useState } from 'react'
import { uploadEnvios } from '../services/api'

export type UploadEnviosProps = {
  onUploaded: (enviosKey: string) => void
}

export default function UploadEnvios({ onUploaded }: UploadEnviosProps) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalSize = useMemo(
    () => files.reduce((acc, file) => acc + file.size, 0),
    [files]
  )

  const handleSelectFiles = (fileList: FileList | null) => {
    if (!fileList) {
      return
    }
    const next = Array.from(fileList).filter((file) => file.name.toLowerCase().endsWith('.txt'))
    setFiles(next)
    setError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Selecciona al menos un archivo .txt')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await uploadEnvios(files)
      onUploaded(response.enviosKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="upload-screen">
      <div className="upload-card">
        <h2>Cargar archivos de envios</h2>
        <p>Selecciona un archivo .txt o una carpeta con archivos .txt.</p>

        <div className="upload-actions">
          <label className="btn ghost">
            Seleccionar archivos
            <input
              type="file"
              accept=".txt"
              multiple
              onChange={(event) => handleSelectFiles(event.target.files)}
              hidden
            />
          </label>
          <label className="btn ghost">
            Seleccionar carpeta
            <input
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is supported in Chromium browsers
              webkitdirectory=""
              onChange={(event) => handleSelectFiles(event.target.files)}
              hidden
            />
          </label>
        </div>

        <div className="upload-summary">
          <span>{`Archivos: ${files.length}`}</span>
          <span>{`Tamano: ${(totalSize / 1024 / 1024).toFixed(2)} MB`}</span>
        </div>

        {error ? <div className="upload-error">{error}</div> : null}

        <div className="upload-footer">
          <button className="btn primary" onClick={handleUpload} disabled={loading}>
            {loading ? 'Cargando...' : 'Usar archivos'}
          </button>
        </div>
      </div>
    </div>
  )
}
