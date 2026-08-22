import React from 'react';
import styles from './ProductCartLoader.module.css';

export function ProductCartLoader() {
  return (
    <div className={styles['cart-loader-wrapper']}>
      <div className={styles['cart-loader']}>
        <div className={styles['items-container']}>
          {/* Mobile Phone */}
          <div id="item-mobile" className={`${styles.item} ${styles.mobile}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          
          {/* Laptop */}
          <div id="item-laptop" className={`${styles.item} ${styles.laptop}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="2" y1="20" x2="22" y2="20"></line>
            </svg>
          </div>
          
          {/* Tablet */}
          <div id="item-tab" className={`${styles.item} ${styles.tablet}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          
          {/* Headphone */}
          <div id="item-headphone" className={`${styles.item} ${styles.headphone}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            </svg>
          </div>
          
          {/* Mixer */}
          <div id="item-mixer" className={`${styles.item} ${styles.mixer}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2"></circle>
              <circle cx="12" cy="18" r="2"></circle>
              <circle cx="18" cy="6" r="2"></circle>
              <path d="M6 8v10"></path>
              <path d="M12 6v10"></path>
              <path d="M18 8v10"></path>
            </svg>
          </div>
        </div>

        <div id="cart-icon" className={styles['cart-icon']}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
        </div>

        <div className={styles['loading-text']}>
          Loading<span className={styles.dot}>.</span><span className={styles.dot}>.</span><span className={styles.dot}>.</span>
        </div>
      </div>
    </div>
  );
}
