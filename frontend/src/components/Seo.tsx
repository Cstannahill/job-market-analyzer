import React from 'react';

/**
 * Base URL for canonical and Open Graph URL generation.
 *
 * Sourced from Vite's import.meta.env.FRONTEND_URL. This may be undefined
 * at runtime if the environment variable is not provided. The value is
 * concatenated with provided `path` props to form absolute URLs.
 *
 * Note: do not modify this constant here — change the environment variable
 * or Vite config when deploying to a different origin.
 */
const BASE_URL = import.meta.env.FRONTEND_URL;

/**
 * Props for the `Seo` component.
 *
 * @typedef {Object} SeoProps
 * @property {string} title - The document title (required).
 * @property {string} [description] - Meta description content.
 * @property {string} [path] - Path relative to the site root used for canonical and og:url (e.g. "about").
 * @property {string} [image] - Absolute URL to an image used for Open Graph / Twitter cards.
 * @property {string} [type='website'] - Open Graph type (defaults to 'website').
 * @property {boolean} [noindex=false] - When true, emits a robots noindex meta tag.
 * @property {React.ReactNode} [children] - Optional children to render (additional head elements).
 */
/**
 * Props for the `Seo` component.
 */
interface SeoProps {
    /**
     * The document title to render inside the <title> tag.
     */
    title: string;

    /**
     * The meta description content. When provided, a <meta name="description"/>
     * will be emitted and used by search engines and social previews.
     */
    description?: string;

    /**
     * Path relative to the site root used for canonical and og:url.
     * Example: "about" will become `${BASE_URL}/about`.
     */
    path?: string;

    /**
     * Absolute URL to an image used for Open Graph / Twitter cards.
     * Prefer an absolute URL (https://...) so social crawlers can fetch it.
     */
    image?: string;

    /**
     * Open Graph type. Defaults to 'website'.
     * @default 'website'
     */
    type?: string;

    /**
     * When true, emits a <meta name="robots" content="noindex" /> tag
     * to prevent indexing by search engines.
     * @default false
     */
    noindex?: boolean;

    /**
     * Optional children to render (additional head elements).
     */
    children?: React.ReactNode;
}

/**
 * SEO helper component that emits document <title> and common meta tags.
 *
 * This component directly returns head elements in JSX. With React 19+
 * (and the framework/hydration used by this app) these elements are hoisted
 * into the document <head> at render time.
 *
 * Edge cases:
 * - If `BASE_URL` is undefined, canonical and og:url will be `${undefined}/...` —
 *   ensure FRONTEND_URL is set in your environment when building for production.
 * - `image` should be an absolute URL to be used by social platforms; relative
 *   URLs may not resolve correctly when crawled.
 *
 * @example
 * <Seo title="About — My Site" description="About page" path="about" />
 *
 * @param {string} props.title - The document title. (required)
 * @param {string} [props.description] - Meta description content.
 * @param {string} [props.path] - Path relative to the site root used for canonical and og:url (e.g. "about").
 * @param {string} [props.image] - Absolute URL to an image used for Open Graph / Twitter cards.
 * @param {string} [props.type='website'] - Open Graph type. @default 'website'
 * @param {boolean} [props.noindex=false] - When true, emits a robots noindex meta tag. @default false
 * @param {React.ReactNode} [props.children] - Optional children to render (additional head elements).
 * @returns {JSX.Element} JSX fragment containing title, meta, link, and social preview tags.
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
