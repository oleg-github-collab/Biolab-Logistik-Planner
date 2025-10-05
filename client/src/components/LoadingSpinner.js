import React from 'react';

/**
 * Універсальний компонент для відображення стану завантаження
 *
 * @param {Object} props
 * @param {string} props.variant - Варіант відображення: 'spinner', 'skeleton', 'dots', 'pulse'
 * @param {string} props.size - Розмір: 'sm', 'md', 'lg', 'xl'
 * @param {string} props.color - Колір (Tailwind класи)
 * @param {boolean} props.fullScreen - Відображати на весь екран
 * @param {string} props.text - Текст для відображення
 * @param {string} props.className - Додаткові CSS класи
 */
const LoadingSpinner = ({
  variant = 'spinner',
  size = 'md',
  color = 'blue-600',
  fullScreen = false,
  text = '',
  className = ''
}) => {
  // Розміри для різних варіантів
  const sizeClasses = {
    spinner: {
      sm: 'w-6 h-6 border-2',
      md: 'w-10 h-10 border-3',
      lg: 'w-16 h-16 border-4',
      xl: 'w-24 h-24 border-4'
    },
    dots: {
      sm: 'w-2 h-2',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
      xl: 'w-6 h-6'
    },
    pulse: {
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
      xl: 'w-24 h-24'
    }
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // Spinner варіант
  const SpinnerVariant = () => (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses.spinner[size]} border-gray-200 border-t-${color} rounded-full animate-spin transition-all duration-300`}
      />
      {text && (
        <p className={`text-${color} ${textSizeClasses[size]} font-medium animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );

  // Dots варіант
  const DotsVariant = () => (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="flex space-x-2">
        <div
          className={`${sizeClasses.dots[size]} bg-${color} rounded-full animate-bounce`}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={`${sizeClasses.dots[size]} bg-${color} rounded-full animate-bounce`}
          style={{ animationDelay: '150ms' }}
        />
        <div
          className={`${sizeClasses.dots[size]} bg-${color} rounded-full animate-bounce`}
          style={{ animationDelay: '300ms' }}
        />
      </div>
      {text && (
        <p className={`text-${color} ${textSizeClasses[size]} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  // Pulse варіант
  const PulseVariant = () => (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div
          className={`${sizeClasses.pulse[size]} bg-${color} rounded-full animate-ping absolute opacity-75`}
        />
        <div
          className={`${sizeClasses.pulse[size]} bg-${color} rounded-full relative`}
        />
      </div>
      {text && (
        <p className={`text-${color} ${textSizeClasses[size]} font-medium animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );

  // Bars варіант
  const BarsVariant = () => {
    const barHeights = {
      sm: ['h-4', 'h-6', 'h-8', 'h-6', 'h-4'],
      md: ['h-6', 'h-8', 'h-10', 'h-8', 'h-6'],
      lg: ['h-8', 'h-12', 'h-16', 'h-12', 'h-8'],
      xl: ['h-12', 'h-16', 'h-24', 'h-16', 'h-12']
    };

    const barWidth = {
      sm: 'w-1',
      md: 'w-1.5',
      lg: 'w-2',
      xl: 'w-3'
    };

    return (
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex items-end space-x-1">
          {barHeights[size].map((height, index) => (
            <div
              key={index}
              className={`${barWidth[size]} ${height} bg-${color} rounded-full animate-pulse`}
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>
        {text && (
          <p className={`text-${color} ${textSizeClasses[size]} font-medium`}>
            {text}
          </p>
        )}
      </div>
    );
  };

  // Вибір варіанту
  const renderVariant = () => {
    switch (variant) {
      case 'dots':
        return <DotsVariant />;
      case 'pulse':
        return <PulseVariant />;
      case 'bars':
        return <BarsVariant />;
      case 'spinner':
      default:
        return <SpinnerVariant />;
    }
  };

  // Full-screen wrapper
  if (fullScreen) {
    return (
      <div className={`fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 ${className}`}>
        {renderVariant()}
      </div>
    );
  }

  // Inline wrapper
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      {renderVariant()}
    </div>
  );
};

export default LoadingSpinner;
