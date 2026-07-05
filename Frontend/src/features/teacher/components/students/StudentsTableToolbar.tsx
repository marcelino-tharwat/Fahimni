import { useTranslation } from 'react-i18next';
import { Search, Download, X, Loader2 } from 'lucide-react';
import { Input, Button } from '@/shared/components/ui';

interface StudentsTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  isExporting: boolean;
}

export function StudentsTableToolbar({
  search,
  onSearchChange,
  onExport,
  isExporting,
}: StudentsTableToolbarProps) {
  const { t } = useTranslation('teacher');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 p-4">
      <div className="w-full sm:w-80">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('students.table.searchPlaceholder')}
          dir="auto"
          className="h-10"
          icon={<Search className="h-4 w-4" />}
          trailing={
            search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label={t('students.empty.noResults.action')}
                className="pointer-events-auto text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
      </div>

      <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {t('students.table.exportButton')}
      </Button>
    </div>
  );
}
