import { useQuery } from '@tanstack/react-query';
import { Check, CircleAlert, Lightbulb, LoaderCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { getErrorMessage, normalizePage } from '../lib/utils';
import type { SoftwareApplication } from '../types';
import { Button } from './ui';

export function SoftwareSelector({
  onSelect,
  onSelectCustom,
  selectedIds = [],
  options,
}: {
  onSelect: (software: SoftwareApplication) => void;
  onSelectCustom: (name: string) => void;
  selectedIds?: string[];
  options?: SoftwareApplication[];
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const trimmedSearch = search.trim();
  const isBrowsing = isOpen && trimmedSearch.length === 0;
  const isSearching = trimmedSearch.length >= 2;

  const searchQuery = useQuery({
    queryKey: ['software-search', trimmedSearch],
    queryFn: async () =>
      normalizePage<SoftwareApplication>(
        await apiRequest(
          `/software/search?q=${encodeURIComponent(trimmedSearch)}&page=1&pageSize=10`,
        ),
        1,
        10,
      ).items,
    enabled: options === undefined && isSearching,
  });
  const browseQuery = useQuery({
    queryKey: ['software-browse'],
    queryFn: async () =>
      normalizePage<SoftwareApplication>(await apiRequest('/software?page=1&pageSize=20'), 1, 20)
        .items,
    enabled: options === undefined && isBrowsing,
  });
  const localResults = useMemo(
    () =>
      options?.filter((software) =>
        `${software.name} ${software.manufacturer ?? ''}`
          .toLocaleLowerCase('tr-TR')
          .includes(trimmedSearch.toLocaleLowerCase('tr-TR')),
      ) ?? [],
    [options, trimmedSearch],
  );
  const activeQuery = isSearching ? searchQuery : browseQuery;
  const results = options === undefined ? (activeQuery.data ?? []) : localResults;
  const visibleResults = results.filter((software) => !selectedIds.includes(software.id));
  const showResults = isBrowsing || isSearching;
  const showNoResult = isSearching && !searchQuery.isFetching && visibleResults.length === 0;

  return (
    <div className="software-selector">
      <label className="search-field search-field--large">
        <Search aria-hidden="true" />
        <span className="sr-only">Program ara</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          placeholder="Program adı veya üretici ile arayın…"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="software-results"
          aria-autocomplete="list"
        />
        {activeQuery.isFetching && <LoaderCircle className="spin" aria-label="Aranıyor" />}
      </label>
      {trimmedSearch.length > 0 && trimmedSearch.length < 2 && (
        <small className="field-hint">Arama için en az 2 karakter girin.</small>
      )}
      {showResults && (
        <div className="software-results" id="software-results" role="listbox">
          {visibleResults.map((software) => (
            <button
              type="button"
              key={software.id}
              role="option"
              aria-selected="false"
              onClick={() => {
                onSelect(software);
                setSearch('');
              }}
            >
              <span className="software-results__icon">
                {software.name.slice(0, 2).toLocaleUpperCase('tr-TR')}
              </span>
              <span>
                <strong>{software.name}</strong>
                <small>
                  {[software.manufacturer, software.isPaid ? 'Ücretli' : 'Ücretsiz']
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <Plus aria-hidden="true" />
            </button>
          ))}
          {isBrowsing && !browseQuery.isFetching && visibleResults.length === 0 && (
            <div className="software-empty">
              <span>Kayıtlı program bulunamadı.</span>
            </div>
          )}
          {showNoResult && (
            <div className="software-empty">
              <span>
                <Lightbulb aria-hidden="true" />
              </span>
              <div>
                <strong>Aradığınız program listede bulunamadı.</strong>
                <p>Bu programı, katalogda olmasa da doğrudan talebinize ekleyebilirsiniz.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                icon={<Plus aria-hidden="true" />}
                onClick={() => {
                  onSelectCustom(trimmedSearch);
                  setSearch('');
                }}
              >
                İstediğim Program Listede Yok
              </Button>
            </div>
          )}
          {activeQuery.isError && (
            <div className="software-empty software-empty--error" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{getErrorMessage(activeQuery.error)}</span>
            </div>
          )}
        </div>
      )}
      {selectedIds.length > 0 && (
        <div className="selection-note">
          <Check aria-hidden="true" /> {selectedIds.length} program talebe eklendi
        </div>
      )}
    </div>
  );
}
