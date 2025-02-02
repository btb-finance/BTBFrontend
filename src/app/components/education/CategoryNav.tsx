interface Category {
  id: string;
  name: string;
  active?: boolean;
}

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategoryNav({ categories, activeCategory, onCategoryChange }: CategoryNavProps) {
  return (
    <nav className="flex space-x-4 overflow-x-auto pb-2">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
            activeCategory === category.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
}
