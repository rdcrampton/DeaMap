'use client'

import { useState, useCallback, useMemo } from 'react'
import { Activity } from 'lucide-react'
import type { DeaRecord } from '@/types'
import { filterRecords, getUniqueTypes } from '@/utils/helpers'
import DeaCard from '@/components/DeaCard'
import DeaModal from '@/components/DeaModal'
import DeaFormModal from '@/components/DeaFormModal'
import SearchFilters from '@/components/SearchFilters'
import StatsDashboard from '@/components/StatsDashboard'
import HeroHeader from '@/components/HeroHeader'
import LoadingScreen from '@/components/LoadingScreen'
import useDeaRecords from '@/hooks/useDeaRecords'

export default function Home() {
    const {
        records,
        loading,
        loadingMore,
        error,
        hasMore,
        totalRecords,
        loadMore,
        refreshRecords,
        createRecord,
        updateRecord,
        deleteRecord
    } = useDeaRecords()

    const [selectedRecord, setSelectedRecord] = useState<DeaRecord | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [formModalOpen, setFormModalOpen] = useState(false)
    const [editingRecord, setEditingRecord] = useState<DeaRecord | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('')

    // Memoize derived values to prevent unnecessary recalculations
    const filteredRecords = useMemo(() =>
        filterRecords(records, searchTerm, filterType),
        [records, searchTerm, filterType]
    )

    const uniqueTypes = useMemo(() =>
        getUniqueTypes(records),
        [records]
    )

    /**
     * Opens the modal with the selected record for viewing
     */
    const handleOpenRecordModal = useCallback((record: DeaRecord) => {
        setSelectedRecord(record)
        setModalOpen(true)
    }, [])

    /**
     * Opens the form modal for editing a record
     */
    const handleEditRecord = useCallback((record: DeaRecord) => {
        setEditingRecord(record)
        setFormModalOpen(true)
    }, [])

    /**
     * Opens the form modal for creating a new record
     */
    const handleCreateRecord = useCallback(() => {
        setEditingRecord(null)
        setFormModalOpen(true)
    }, [])

    /**
     * Handles record deletion with confirmation
     */
    const handleDelete = useCallback(async (id: number) => {
        if (window.confirm('¿Está seguro de que desea eliminar este registro?')) {
            try {
                await deleteRecord(id)
                refreshRecords()
            } catch (error) {
                console.error('Error al eliminar el registro:', error)
            }
        }
    }, [deleteRecord, refreshRecords])

    /**
     * Closes the view modal and resets the selected record
     */
    const handleCloseModal = useCallback(() => {
        setSelectedRecord(null)
        setModalOpen(false)
    }, [])

    /**
     * Closes the form modal and resets the editing record
     */
    const handleCloseFormModal = useCallback(() => {
        setEditingRecord(null)
        setFormModalOpen(false)
    }, [])

    /**
     * Saves a record (create or update) and refreshes the list
     */
    const handleSaveRecord = useCallback(async (record: Omit<DeaRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (editingRecord?.id) {
                await updateRecord(editingRecord.id, record as DeaRecord)
            } else {
                await createRecord(record as DeaRecord)
            }
            refreshRecords()
            handleCloseFormModal()
        } catch (error) {
            console.error('Error al guardar el registro:', error)
        }
    }, [editingRecord, createRecord, updateRecord, refreshRecords, handleCloseFormModal])

    if (loading) return <LoadingScreen />

    if (error) return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-2">Error de carga</h2>
                <p className="text-gray-700">No pudimos cargar los datos. Por favor, inténtelo de nuevo.</p>
                <button
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={refreshRecords}
                >
                    Reintentar
                </button>
            </div>
        </div>
    )

    return (
        <main className="min-h-screen w-full max-w-full bg-gradient-to-br from-blue-50 to-indigo-100">
            <HeroHeader />

            <div className="container mx-auto px-4 sm:px-6 py-6">
                <StatsDashboard records={records} />

                <SearchFilters
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterType={filterType}
                    onFilterChange={setFilterType}
                    uniqueTypes={uniqueTypes}
                />

                <div className="mt-8 pb-16">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
                            {filteredRecords.length} DEAs encontrados
                        </h2>
                        <button
                            onClick={handleCreateRecord}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Activity className="w-4 h-4 mr-2" />
                            <span>Añadir nuevo DEA</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredRecords.map(record => (
                            <DeaCard
                                key={record.id}
                                record={record}
                                onEdit={() => handleEditRecord(record)}
                                onDelete={() => handleDelete(record.id)}
                                onView={() => handleOpenRecordModal(record)}
                            />
                        ))}

                        {filteredRecords.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white bg-opacity-70 rounded-xl shadow-md">
                                <p className="text-xl text-gray-600">No se encontraron registros con los criterios especificados.</p>
                            </div>
                        )}
                    </div>

                    {/* Load More Button and Info */}
                    {!searchTerm && !filterType && (
                        <div className="mt-8 flex flex-col items-center gap-4">
                            <div className="text-center text-sm text-gray-600">
                                Mostrando {records.length} de {totalRecords} registros
                            </div>
                            
                            {hasMore && (
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {loadingMore ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Cargando...
                                        </>
                                    ) : (
                                        'Cargar más registros'
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <DeaModal
                record={selectedRecord}
                isOpen={modalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveRecord}
            />

            <DeaFormModal
                record={editingRecord}
                isOpen={formModalOpen}
                onClose={handleCloseFormModal}
                onSave={handleSaveRecord}
            />
        </main>
    )
}
