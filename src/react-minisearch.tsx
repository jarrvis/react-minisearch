import MiniSearch, { Options, SearchOptions, SearchResult, Suggestion } from 'minisearch'
import React, { useEffect, useState, useRef, PropsWithChildren } from 'react'

export interface UseMiniSearch<T = any> {
  search: (query: string, options?: SearchOptions) => void,
  searchResults: T[] | null,
  rawResults: SearchResult[] | null,
  autoSuggest: (query: string, options?: SearchOptions) => void,
  suggestions: Suggestion[] | null,
  add: (document: T) => void,
  addAll: (documents: T[]) => void,
  addAllAsync: (documents: T[], options?: { chunkSize?: number }) => Promise<void>,
  remove: (document: T) => void,
  removeById: (id: any) => void,
  removeAll: (documents?: T[], options?: { ignoreIfMissing?: boolean }) => void,
  isIndexing: boolean,
  clearSearch: () => void,
  clearSuggestions: () => void,
  miniSearch: MiniSearch<T>
}

export function useMiniSearch<T = any> (documents: T[], options: Options<T>): UseMiniSearch<T> {
  const miniSearchRef = useRef<MiniSearch<T>>(new MiniSearch<T>(options))
  const [rawResults, setRawResults] = useState<SearchResult[] | null>(null)
  const [searchResults, setSearchResults] = useState<T[] | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const documentByIdRef = useRef<{ [key: string]: T }>({})
  const [isIndexing, setIsIndexing] = useState<boolean>(false)
  const idField = options.idField || MiniSearch.getDefault('idField') as Options['idField']
  const extractField = options.extractField || MiniSearch.getDefault('extractField') as Options['extractField']
  const gatherById = (documents) => documents.reduce((byId, doc) => {
    const id = extractField(doc, idField)
    byId[id] = doc
    return byId
  }, {})

  const miniSearch = miniSearchRef.current
  const documentById = documentByIdRef.current

  const search = (query: string, searchOptions?: SearchOptions): void => {
    const results = miniSearch.search(query, searchOptions)
    const searchResults = results.map(({ id }) => documentById[id])
    setSearchResults(searchResults)
    setRawResults(results)
  }

  const autoSuggest = (query: string, searchOptions?: SearchOptions): void => {
    const suggestions = miniSearch.autoSuggest(query, searchOptions)
    setSuggestions(suggestions)
  }

  const add = (document: T): void => {
    documentByIdRef.current[extractField(document, idField)] = document
    miniSearch.add(document)
  }

  const addAll = (documents: T[]): void => {
    const byId = gatherById(documents)
    documentByIdRef.current = Object.assign(documentById, byId)
    miniSearch.addAll(documents)
  }

  const addAllAsync = (documents: T[], options?: { chunkSize?: number }): Promise<void> => {
    const byId = gatherById(documents)
    documentByIdRef.current = Object.assign(documentById, byId)
    setIsIndexing(true)

    return miniSearch.addAllAsync(documents, options || {}).then(() => {
      setIsIndexing(false)
    })
  }

  const remove = (document: T): void => {
    miniSearch.remove(document)
    documentByIdRef.current = removeFromMap<T>(documentById, extractField(document, idField))
  }

  const removeById = (id: any): void => {
    const document = documentById[id]
    if (document == null) {
      throw new Error(`react-minisearch: document with id ${id} does not exist in the index`)
    }
    miniSearch.remove(document)
    documentByIdRef.current = removeFromMap<T>(documentById, id)
  }

  const removeAll = (documents?: T[], options?: { ignoreIfMissing?: boolean }): void => {
    if (!documents) {
      miniSearch.removeAll()
      documentByIdRef.current = {}
    } else {
      if (options?.ignoreIfMissing) {
        documents = documents.filter(document => documentById[extractField(document, idField)])
      }
      miniSearch.removeAll(documents)
      const idsToRemove = documents.map((doc) => extractField(doc, idField))
      documentByIdRef.current = removeManyFromMap<T>(documentById, idsToRemove)
    }
  }

  const clearSearch = (): void => {
    setSearchResults(null)
    setRawResults(null)
  }

  const clearSuggestions = (): void => {
    setSuggestions(null)
  }

  useOnMount(() => {
    addAll(documents)
  })

  return {
    search,
    searchResults,
    rawResults,
    autoSuggest,
    suggestions,
    add,
    addAll,
    addAllAsync,
    remove,
    removeById,
    removeAll,
    isIndexing,
    clearSearch,
    clearSuggestions,
    miniSearch
  }
}

function removeFromMap<T> (map: { [key: string]: T }, keyToRemove: any): { [key: string]: T } {
  delete map[keyToRemove]
  return map
}

function removeManyFromMap<T> (map: { [key: string]: T }, keysToRemove: any[]): { [key: string]: T } {
  keysToRemove.forEach((keyToRemove) => {
    delete map[keyToRemove]
  })
  return map
}

function getDisplayName<PropsT> (Component: React.ComponentType<PropsT>): string {
  return Component.displayName || Component.name || 'Component'
}

function useOnMount (callback: React.EffectCallback) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useEffect(callback, [])
}

export function withMiniSearch<OwnProps, T = any> (
  documents: T[],
  options: Options<T>,
  Component: React.ComponentType<OwnProps & UseMiniSearch<T>>
): React.FC<OwnProps> {
  const WithMiniSearch = (props: OwnProps) => {
    const miniSearchProps = useMiniSearch<T>(documents, options)
    return <Component {...miniSearchProps} {...props} />
  }

  WithMiniSearch.displayName = `WithMiniSearch(${getDisplayName(Component)})`

  return WithMiniSearch
}

export interface WithMiniSearchProps<T = any> {
  documents: T[],
  options: Options<T>,
  children: (props: UseMiniSearch<T>) => JSX.Element | null,
}

export const WithMiniSearch = <T, >({ documents, options, children }: PropsWithChildren<WithMiniSearchProps<T>>) => {
  const miniSearchProps = useMiniSearch<T>(documents, options)
  return children(miniSearchProps)
}
