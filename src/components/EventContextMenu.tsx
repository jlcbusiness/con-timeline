import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import type { TimelineEvent } from '../types/timeline';
import { getEventColors } from '../utils/timelineUtils';

type LockMode = 'off' | 'time' | 'mega';
type Submenu = 'lock' | 'fandom' | 'color' | null;

interface EventContextMenuProps {
  event: TimelineEvent;
  x: number;
  y: number;
  fandomSuggestions: string[];
  onAddFandom: (name: string) => { name: string };
  onClose: () => void;
  onEdit: (event: TimelineEvent) => void;
  onCopy: (event: TimelineEvent) => void;
  onUpdateEvent: (eventId: string, updates: Partial<TimelineEvent>) => void;
  onDeleteEvent: (eventId: string) => void;
}

const normalizeColor = (color: string) => color.trim().toLowerCase();

export const EventContextMenu: React.FC<EventContextMenuProps> = ({
  event,
  x,
  y,
  fandomSuggestions,
  onAddFandom,
  onClose,
  onEdit,
  onCopy,
  onUpdateEvent,
  onDeleteEvent
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [openSubmenu, setOpenSubmenu] = useState<Submenu>(null);
  const [submenuOpensLeft, setSubmenuOpensLeft] = useState(false);
  const [submenuWidth, setSubmenuWidth] = useState(160);
  const [isAddingFandom, setIsAddingFandom] = useState(false);
  const [newFandomName, setNewFandomName] = useState('');

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const viewportPadding = 8;
    const rect = menu.getBoundingClientRect();
    const nextX = Math.max(viewportPadding, Math.min(x, window.innerWidth - rect.width - viewportPadding));
    const nextY = Math.max(viewportPadding, Math.min(y, window.innerHeight - rect.height - viewportPadding));
    setPosition(current => Math.abs(current.x - nextX) <= 0.5 && Math.abs(current.y - nextY) <= 0.5
      ? current
      : { x: nextX, y: nextY });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (!menuRef.current?.contains(pointerEvent.target as Node)) onClose();
    };
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const openMenu = (submenu: Exclude<Submenu, null>, trigger: HTMLElement, preferredWidth: number) => {
    const triggerRect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const leftSpace = Math.max(0, triggerRect.left - viewportPadding - gap);
    const rightSpace = Math.max(0, window.innerWidth - triggerRect.right - viewportPadding - gap);
    const opensLeft = leftSpace > rightSpace;
    setSubmenuOpensLeft(opensLeft);
    setSubmenuWidth(Math.min(preferredWidth, opensLeft ? leftSpace : rightSpace));
    setOpenSubmenu(submenu);
  };

  const updateAndClose = (updates: Partial<TimelineEvent>) => {
    onUpdateEvent(event.id, updates);
    onClose();
  };

  const setLockMode = (mode: LockMode) => updateAndClose({
    lockTime: mode !== 'off',
    megaLock: mode === 'mega'
  });

  const setFandom = (fandom?: string) => updateAndClose({ fandom });

  const handleNewFandomKeyDown = (keyboardEvent: React.KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key !== 'Enter') return;
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    const name = newFandomName.trim();
    if (name) setFandom(onAddFandom(name).name);
  };

  const submenuClass = `absolute top-0 z-[10000] min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl ${submenuOpensLeft ? 'right-full mr-1' : 'left-full ml-1'}`;
  const currentLockMode: LockMode = event.megaLock ? 'mega' : event.lockTime ? 'time' : 'off';

  return createPortal(
    <div
      ref={menuRef}
      data-event-context-menu="true"
      className="fixed z-[9999] min-w-[13rem] overflow-visible rounded-md border border-gray-200 bg-white py-1 shadow-xl"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      role="menu"
      aria-label={`Event actions for ${event.title}`}
    >
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openSubmenu === 'lock'}
          onMouseEnter={mouseEvent => openMenu('lock', mouseEvent.currentTarget, 160)}
          onClick={clickEvent => openMenu('lock', clickEvent.currentTarget, 160)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          <span>Lock</span>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
        {openSubmenu === 'lock' && (
          <div className={submenuClass} style={{ width: `${submenuWidth}px` }} role="radiogroup" aria-label="Event lock mode">
            {(['off', 'time', 'mega'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={currentLockMode === mode}
                onClick={() => setLockMode(mode)}
                className={`w-full px-3 py-2 text-left text-sm ${currentLockMode === mode ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {mode === 'off' ? 'Off' : mode === 'time' ? 'Time' : 'ULTRA'}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" role="menuitemcheckbox" aria-checked={event.intangible} onClick={() => updateAndClose({ intangible: !event.intangible })} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
        <span>Intangible</span>
        <span className="text-xs text-gray-500">{event.intangible ? 'ON' : 'off'}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openSubmenu === 'color'}
          onMouseEnter={mouseEvent => openMenu('color', mouseEvent.currentTarget, 124)}
          onClick={clickEvent => openMenu('color', clickEvent.currentTarget, 124)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          <span>Color</span>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
        {openSubmenu === 'color' && (
          <div className={`${submenuClass} p-2`} style={{ width: `${submenuWidth}px` }}>
            <div className="grid grid-cols-[repeat(auto-fit,2rem)] place-content-center justify-center gap-2">
              {getEventColors().map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateAndClose({ color })}
                  className={`h-8 w-8 rounded-md transition-transform hover:scale-105 ${normalizeColor(event.color) === normalizeColor(color) ? 'border-2 border-gray-900 shadow-[inset_0_0_0_1px_white] ring-2 ring-gray-300' : 'border border-gray-200'}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Set event color to ${color}`}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={openSubmenu === 'fandom'}
          onMouseEnter={mouseEvent => openMenu('fandom', mouseEvent.currentTarget, 220)}
          onClick={clickEvent => openMenu('fandom', clickEvent.currentTarget, 220)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          <span>Fandom</span>
          <ChevronRight size={14} className="text-gray-400" />
        </button>
        {openSubmenu === 'fandom' && (
          <div className={submenuClass} style={{ width: `${submenuWidth}px` }} role="menu" aria-label="Set event fandom">
            {event.fandom?.trim() && (
              <button type="button" role="menuitem" onClick={() => setFandom(undefined)} className="w-full truncate px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50">
                Remove
              </button>
            )}
            {isAddingFandom ? (
              <div className="border-t border-gray-100 px-2 py-2">
                <input
                  autoFocus
                  type="text"
                  value={newFandomName}
                  onChange={changeEvent => setNewFandomName(changeEvent.target.value)}
                  onKeyDown={handleNewFandomKeyDown}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Fandom name"
                  aria-label="New fandom name"
                />
              </div>
            ) : (
              <button type="button" role="menuitem" onClick={() => setIsAddingFandom(true)} className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                Add
              </button>
            )}
            {fandomSuggestions.length > 0 ? (
              <div className="border-t border-gray-100 pt-1">
                {fandomSuggestions.map(fandom => (
                  <button
                    key={fandom.toLocaleLowerCase()}
                    type="button"
                    role="menuitemradio"
                    aria-checked={event.fandom?.toLocaleLowerCase() === fandom.toLocaleLowerCase()}
                    onClick={() => setFandom(fandom)}
                    className={`w-full truncate px-3 py-2 text-left text-sm ${event.fandom?.toLocaleLowerCase() === fandom.toLocaleLowerCase() ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    title={fandom}
                  >
                    {fandom}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">No fandoms yet</div>
            )}
          </div>
        )}
      </div>

      <button type="button" role="menuitem" onClick={() => { onClose(); onEdit(event); }} className="flex w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
        Edit
      </button>
      <button type="button" role="menuitem" onClick={() => { onClose(); onCopy(event); }} className="flex w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
        Copy
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          if (window.confirm(`Delete event "${event.title}"?`)) onDeleteEvent(event.id);
        }}
        className="flex w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </div>,
    document.body
  );
};