import React from 'react';
const BASE_URL = import.meta.env.FRONTEND_URL;
type SeoProps = {
    title: string;
    description?: string;
    path?: string;
    image?: string;
    type?: string;
    noindex?: boolean;
    children?: React.ReactNode;
};

/**
 * Simple SEO component that declares document metadata directly in JSX.
 * With React 19's document metadata support these elements are hoisted to <head>.
 */
const Seo: React.FC<SeoProps> = ({
    title,
    description,
    path,
    image,
    type = 'website',
    noindex = false,
    children,
}) => {
    return (
        <>
            <title>{title}</title>
            {description && <meta name="description" content={description} />}
            {path && <link rel="canonical" href={`${BASE_URL}/${path}`} />}

            {/* Open Graph */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={title} />
            {description && <meta property="og:description" content={description} />}
            {path && <meta property="og:url" content={`${BASE_URL}/${path}`} />}
            {image && <meta property="og:image" content={image} />}

            {/* Twitter */}
            <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
            <meta name="twitter:title" content={title} />
            {description && <meta name="twitter:description" content={description} />}
            {image && <meta name="twitter:image" content={image} />}

            {noindex && <meta name="robots" content="noindex" />}

            {children}
        </>
    );
};

export default Seo;
