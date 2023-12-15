import { useCallback } from "react"
import { ICommand, IScript } from "@/worker/meta_table/script"

import { shortenId } from "@/lib/utils"
import { useCurrentPathInfo } from "@/hooks/use-current-pathinfo"
import { useGoto } from "@/hooks/use-goto"
import { useScripts } from "@/hooks/use-scripts"
import { useSqlite } from "@/hooks/use-sqlite"
import { IUIColumn } from "@/hooks/use-table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import { useScriptFunction } from "../script-container/hook"
import { useTableAppStore } from "./store"

export function GridContextMenu({
  children,
  deleteRows,
  getRowByIndex,
  getFieldByIndex,
}: {
  getFieldByIndex: (index: number) => IUIColumn
  deleteRows: (start: number, end: number) => void
  getRowByIndex: (index: number) => any
  children: React.ReactNode
}) {
  const { selection, clearSelection } = useTableAppStore()
  const count = selection.current?.range.height ?? 0
  const { space, tableId } = useCurrentPathInfo()
  const scripts = useScripts(space)
  const { callFunction } = useScriptFunction()
  const { getOrCreateTableSubDoc } = useSqlite(space)
  const goto = useGoto()
  const getRow = useCallback(() => {
    if (!selection.current) {
      return
    }
    const rowIndex = selection.current?.range.y
    const row = getRowByIndex(rowIndex)
    return row
  }, [getRowByIndex, selection])

  const getRows = useCallback(() => {
    if (!selection.current) {
      return
    }
    const { y, height } = selection.current?.range
    const rows = []
    for (let i = y; i < y + height; i++) {
      const row = getRowByIndex(i)
      rows.push(row)
    }
    return rows
  }, [getRowByIndex, selection])

  const getField = useCallback(() => {
    if (!selection.current) {
      return
    }
    const cellIndex = selection.current?.range.x
    const field = getFieldByIndex(cellIndex)
    return field
  }, [getFieldByIndex, selection])

  const getCell = useCallback(() => {
    const row = getRow()
    const field = getField()
    if (!row || !field) return
    const cell = row[field.table_column_name!]
    return cell
  }, [getField, getRow])

  const openRow = async (right?: boolean) => {
    const row = getRow()
    if (!row) return
    const shortId = shortenId(row._id)
    await getOrCreateTableSubDoc({
      docId: shortId,
      title: row.title,
      tableId: tableId!,
    })
    if (right) {
      goto(space, tableId, shortId)
    } else {
      goto(space, shortId)
    }
  }
  const currentField = getField()

  const openURl = () => {
    const cell = getCell()
    if (!cell) return
    window.open(cell, "_blank")
  }

  const handleScriptActionCall = async (action: IScript, command: ICommand) => {
    const rows = getRows()
    if (!rows?.length) return
    for (const row of rows) {
      await callFunction({
        input: row,
        command: command.name,
        context: {
          tables: action.fieldsMap,
          env: action.envMap,
          currentNodeId: tableId,
          currentRowId: row._id,
          callFromTableAction: true,
        },
        code: action.code,
        id: action.id,
      })
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="h-full w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem inset onSelect={() => openRow()}>
          Open
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={() => openRow(true)}>
          Open Right
        </ContextMenuItem>
        <ContextMenuItem
          inset
          onClick={() => {
            if (!selection.current) {
              return
            }
            const { y, height } = selection.current?.range
            deleteRows(y, y + height)
            clearSelection()
          }}
        >
          Delete Rows ({count})
        </ContextMenuItem>
        <ContextMenuSeparator />
        {currentField?.type === "url" && (
          <>
            <ContextMenuItem inset onSelect={openURl}>
              Open URL
            </ContextMenuItem>
          </>
        )}
        {scripts.map((script) => {
          const hasCommands = Boolean(script.commands?.length)
          if (!hasCommands) {
            return <ContextMenuItem inset>{script.name}</ContextMenuItem>
          }
          return (
            <ContextMenuSub key={script.id}>
              <ContextMenuSubTrigger inset>{script.name}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {script.commands?.map((cmd) => {
                  return (
                    <ContextMenuItem
                      key={cmd.name}
                      onClick={() => {
                        handleScriptActionCall(script, cmd)
                      }}
                    >
                      {cmd.name}
                    </ContextMenuItem>
                  )
                })}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}
