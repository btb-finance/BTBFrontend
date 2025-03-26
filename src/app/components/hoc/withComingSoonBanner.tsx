'use client';

import React from 'react';
import ComingSoonBanner from '../common/ComingSoonBanner';

interface WithComingSoonBannerProps {
  productName?: string;
}

// Higher-order component to wrap pages that aren't live yet
const withComingSoonBanner = (
  WrappedComponent: React.ComponentType<any>,
  options: WithComingSoonBannerProps = {}
) => {
  // Return a new component
  const WithBanner = (props: any) => {
    return (
      <div className="container mx-auto px-4 py-8">
        <ComingSoonBanner productName={options.productName} />
        <WrappedComponent {...props} />
      </div>
    );
  };

  // Set display name for debugging
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  WithBanner.displayName = `withComingSoonBanner(${displayName})`;

  return WithBanner;
};

export default withComingSoonBanner;
