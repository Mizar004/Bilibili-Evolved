import { crossOriginLocalStorage } from '@/core/local-storage'
import { LaunchBarAction, LaunchBarActionProvider } from './launch-bar-action'

export interface HistoryItem {
  value: string
  timestamp: number
}
const SearchHistoryKey = 'search_history:search_history'
const SearchHistoryMaxItems = 20
const getHistoryStorage = () => {
  // Some pages (including Bilibili's home page in Safari) do not create the COLS iframe.
  // Keep search history usable without waiting for an unavailable storage bridge.
  const iframe = dq(
    'iframe[src^="https://s1.hdslb.com/bfs/seed/jinkela/short/cols/iframe.html"][data-loaded="true"]',
  )
  return iframe ? crossOriginLocalStorage : unsafeWindow.localStorage
}
const readHistoryItems = async (key: string, storage: ReturnType<typeof getHistoryStorage>) => {
  const historyText = await storage.getItem(key)
  const historyItems: HistoryItem[] = historyText ? JSON.parse(historyText) : []
  return historyItems
}
export const getHistoryItems = (key = SearchHistoryKey) =>
  readHistoryItems(key, getHistoryStorage())
export const clearHistoryItems = async (key = SearchHistoryKey) =>
  getHistoryStorage().setItem(key, '[]')
export const addHistoryItem = async (keyword: string, key = SearchHistoryKey) => {
  console.log('add', keyword)
  const storage = getHistoryStorage()
  await storage.setItem(
    key,
    JSON.stringify(
      lodash
        .sortBy(
          lodash.uniqBy(
            [
              {
                value: keyword,
                timestamp: Number(new Date()),
              },
              ...(await readHistoryItems(key, storage)),
            ],
            h => h.value,
          ),
          h => h.timestamp,
        )
        .reverse()
        .slice(0, SearchHistoryMaxItems),
    ),
  )
}
export const deleteHistoryItem = async (keyword: string, key = SearchHistoryKey) => {
  const storage = getHistoryStorage()
  const items = await readHistoryItems(key, storage)
  const index = items.findIndex(it => it.value === keyword)
  console.log('delete', keyword, index)
  if (index !== -1) {
    items.splice(index, 1)
    await storage.setItem(key, JSON.stringify(items))
  }
}
export const historyProvider: LaunchBarActionProvider = {
  name: 'history',
  getActions: async () => {
    const { search } = await import('./search-provider')
    const clearAction: LaunchBarAction = {
      name: '清除搜索历史',
      icon: 'mdi-trash-can-outline',
      description: 'Clear History',
      explicitSelect: true,
      action: async () => {
        await clearHistoryItems()
      },
    }
    const historyItems = await getHistoryItems()
    const items = historyItems.map(
      it =>
        ({
          name: it.value,
          icon: 'mdi-history',
          // description: `在 ${formatDate(new Date(it.timestamp))} 搜索过`,
          explicitSelect: true,
          suggestName: it.value,
          action: () => {
            search(it.value)
          },
          deleteAction: async () => {
            await deleteHistoryItem(it.value)
          },
        } as LaunchBarAction),
    )
    if (items.length > 0) {
      items.push(clearAction)
    }
    return items
  },
}
