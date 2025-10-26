import React from 'react';

/**
 * Komponente zur Anzeige von Skeleton-Bildschirmen während des Ladens
 *
 * @param {Object} props
 * @param {string} props.variant - Skeleton-Typ: 'card', 'list', 'table', 'text', 'avatar', 'custom'
 * @param {number} props.count - Anzahl der zu wiederholenden Elemente
 * @param {boolean} props.animate - Ob Shimmer-Animation angezeigt werden soll
 * @param {string} props.className - Zusätzliche CSS-Klassen
 * @param {Object} props.customConfig - Benutzerdefinierte Konfiguration für komplexe Layouts
 */
const SkeletonLoader = ({
  variant = 'card',
  count = 1,
  animate = true,
  className = '',
  customConfig = null
}) => {
  // Basisklasse für Skeleton-Elemente
  const baseSkeletonClass = `bg-gray-200 rounded ${animate ? 'animate-shimmer' : ''}`;

  // Shimmer-Effekt durch Gradient
  const shimmerStyle = animate ? {
    backgroundImage: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 20%, #f0f0f0 40%, #f0f0f0 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s infinite linear'
  } : {};

  // Card skeleton
  const CardSkeleton = () => (
    <div className={`bg-white rounded-lg shadow-md p-6 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className={`${baseSkeletonClass} w-12 h-12 rounded-full`} style={shimmerStyle} />
        <div className="flex-1 space-y-2">
          <div className={`${baseSkeletonClass} h-4 w-3/4`} style={shimmerStyle} />
          <div className={`${baseSkeletonClass} h-3 w-1/2`} style={shimmerStyle} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className={`${baseSkeletonClass} h-4 w-full`} style={shimmerStyle} />
        <div className={`${baseSkeletonClass} h-4 w-5/6`} style={shimmerStyle} />
        <div className={`${baseSkeletonClass} h-4 w-4/6`} style={shimmerStyle} />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-4">
        <div className={`${baseSkeletonClass} h-8 w-24`} style={shimmerStyle} />
        <div className={`${baseSkeletonClass} h-8 w-24`} style={shimmerStyle} />
      </div>
    </div>
  );

  // List skeleton
  const ListSkeleton = () => (
    <div className={`bg-white rounded-lg shadow-md divide-y divide-gray-200 ${className}`}>
      {[...Array(5)].map((_, index) => (
        <div key={index} className="p-4 flex items-center space-x-4">
          <div className={`${baseSkeletonClass} w-10 h-10 rounded-full flex-shrink-0`} style={shimmerStyle} />
          <div className="flex-1 space-y-2">
            <div className={`${baseSkeletonClass} h-4 w-3/4`} style={shimmerStyle} />
            <div className={`${baseSkeletonClass} h-3 w-1/2`} style={shimmerStyle} />
          </div>
          <div className={`${baseSkeletonClass} w-20 h-8 rounded`} style={shimmerStyle} />
        </div>
      ))}
    </div>
  );

  // Table skeleton
  const TableSkeleton = () => (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Table Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className={`${baseSkeletonClass} h-4`} style={shimmerStyle} />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      {[...Array(8)].map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-4 items-center">
            {[...Array(5)].map((_, colIndex) => (
              <div key={colIndex} className={`${baseSkeletonClass} h-4`} style={shimmerStyle} />
            ))}
          </div>
        </div>
      ))}

      {/* Table Footer/Pagination */}
      <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
        <div className={`${baseSkeletonClass} h-4 w-32`} style={shimmerStyle} />
        <div className="flex space-x-2">
          {[...Array(3)].map((_, index) => (
            <div key={index} className={`${baseSkeletonClass} w-8 h-8 rounded`} style={shimmerStyle} />
          ))}
        </div>
      </div>
    </div>
  );

  // Text skeleton (für Absätze)
  const TextSkeleton = ({ lines = 3 }) => (
    <div className={`space-y-2 ${className}`}>
      {[...Array(lines)].map((_, index) => (
        <div
          key={index}
          className={`${baseSkeletonClass} h-4`}
          style={{
            ...shimmerStyle,
            width: index === lines - 1 ? '60%' : '100%'
          }}
        />
      ))}
    </div>
  );

  // Avatar + Text skeleton
  const AvatarTextSkeleton = () => (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${baseSkeletonClass} w-12 h-12 rounded-full flex-shrink-0`} style={shimmerStyle} />
      <div className="flex-1 space-y-2">
        <div className={`${baseSkeletonClass} h-4 w-32`} style={shimmerStyle} />
        <div className={`${baseSkeletonClass} h-3 w-24`} style={shimmerStyle} />
      </div>
    </div>
  );

  // Dashboard Grid skeleton
  const DashboardSkeleton = () => (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6 space-y-3">
            <div className={`${baseSkeletonClass} h-4 w-24`} style={shimmerStyle} />
            <div className={`${baseSkeletonClass} h-8 w-32`} style={shimmerStyle} />
            <div className={`${baseSkeletonClass} h-3 w-20`} style={shimmerStyle} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className={`${baseSkeletonClass} h-6 w-48`} style={shimmerStyle} />
            <div className={`${baseSkeletonClass} h-64 w-full`} style={shimmerStyle} />
          </div>
        ))}
      </div>
    </div>
  );

  // Form skeleton
  const FormSkeleton = () => (
    <div className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className}`}>
      {[...Array(4)].map((_, index) => (
        <div key={index} className="space-y-2">
          <div className={`${baseSkeletonClass} h-4 w-32`} style={shimmerStyle} />
          <div className={`${baseSkeletonClass} h-10 w-full rounded`} style={shimmerStyle} />
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <div className={`${baseSkeletonClass} h-10 w-24 rounded`} style={shimmerStyle} />
        <div className={`${baseSkeletonClass} h-10 w-24 rounded`} style={shimmerStyle} />
      </div>
    </div>
  );

  // Custom skeleton basierend auf Konfiguration
  const CustomSkeleton = () => {
    if (!customConfig) return null;

    return (
      <div className={className}>
        {customConfig.elements?.map((element, index) => (
          <div
            key={index}
            className={`${baseSkeletonClass} ${element.className || ''}`}
            style={{
              ...shimmerStyle,
              width: element.width || '100%',
              height: element.height || '1rem',
              marginBottom: element.marginBottom || '0.5rem'
            }}
          />
        ))}
      </div>
    );
  };

  // Auswahl der Variante
  const renderVariant = () => {
    switch (variant) {
      case 'list':
        return <ListSkeleton />;
      case 'table':
        return <TableSkeleton />;
      case 'text':
        return <TextSkeleton />;
      case 'avatar':
        return <AvatarTextSkeleton />;
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'form':
        return <FormSkeleton />;
      case 'custom':
        return <CustomSkeleton />;
      case 'card':
      default:
        return <CardSkeleton />;
    }
  };

  // Wiederholung von Elementen wenn count > 1
  if (count > 1 && !['table', 'list', 'dashboard'].includes(variant)) {
    return (
      <div className="space-y-4">
        {[...Array(count)].map((_, index) => (
          <React.Fragment key={index}>
            {renderVariant()}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return renderVariant();
};

// CSS für Shimmer-Animation (in global CSS oder tailwind config hinzufügen)
const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
}
`;

export default SkeletonLoader;
export { shimmerStyles };
