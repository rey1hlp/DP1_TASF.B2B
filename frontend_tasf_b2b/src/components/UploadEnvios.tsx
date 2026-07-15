import { useEffect, useMemo, useState } from 'react'
import { uploadEnvios } from '../services/api'
import { formatFileSize, formatInteger } from '../utils/time'

export type UploadEnviosProps = {
  onUploaded: (enviosKey: string) => void
}

export default function UploadEnvios({ onUploaded }: UploadEnviosProps) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEnviosKey, setLastEnviosKey] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lastEnviosKey')
    setLastEnviosKey(stored)
  }, [])

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
      localStorage.setItem('lastEnviosKey', response.enviosKey)
      setLastEnviosKey(response.enviosKey)
      onUploaded(response.enviosKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleUseLast = () => {
    if (lastEnviosKey) {
      onUploaded(lastEnviosKey)
    }
  }

  const handleClear = () => {
    localStorage.removeItem('lastEnviosKey')
    setLastEnviosKey(null)
    setFiles([])
    setError(null)
  }

  if (lastEnviosKey) {
    return (
      <div className="upload-screen">
        <div className="upload-card">
          <h2>Cargar archivos de envios</h2>
          <p>Última carga guardada en el servidor.</p>

          <div className="upload-footer">
            <button className="btn primary" onClick={handleUseLast}>
              Usar última carga
            </button>
            <button className="btn ghost" onClick={handleClear}>
              Subir nuevos archivos
            </button>
          </div>
        </div>
      </div>
    )
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
          <span>{`Archivos: ${formatInteger(files.length)}`}</span>
          <span>{`Tamano: ${formatFileSize(totalSize)}`}</span>
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
