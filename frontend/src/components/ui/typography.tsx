export interface H1Props {
    text: string;
    className?: string;
}
export function H1(props: H1Props) {
    const { text, className } = props
    const classNames = `${className} scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance`
    return (
        <h1 className={classNames}>
            {text}
        </h1>
    )
}

export interface H2Props {
    text: string;
    className?: string;
    underline?: boolean;
    style?: object;
}
export function H2(props: H2Props) {
    const { text, className, underline, style } = props
    const classNames = underline ? `${className} scroll-m-20 border-b text-xl font-semibold tracking-tight` : `${className} scroll-m-20 text-xl font-semibold tracking-tight`
    return (
        <h2 style={style} className={classNames}>
            {text}
        </h2>
    )
}

export function H3() {
    return (
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
            The Joke Tax
        </h3>
    )
}

export function H4() {
    return (
        <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
            People stopped telling jokes
        </h4>
    )
}

export function P() {
    return (
        <p className="leading-7 not-first:mt-6">
            The king, seeing how much happier his subjects were, realized the error of
            his ways and repealed the joke tax.
        </p>
    )
}

export function Blockquote() {
    return (
        <blockquote className="mt-6 border-l-2 pl-6 italic">
            &quot;After all,&quot; he said, &quot;everyone enjoys a good joke, so
            it&apos;s only fair that they should pay for the privilege.&quot;
        </blockquote>
    )
}

export function Table() {
    return (
        <div className="my-6 w-full overflow-y-auto">
            <table className="w-full">
                <thead>
                    <tr className="even:bg-muted m-0 border-t p-0">
                        <th className="border px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right">
                            King&apos;s Treasury
                        </th>
                        <th className="border px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right">
                            People&apos;s happiness
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="even:bg-muted m-0 border-t p-0">
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Empty
                        </td>
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Overflowing
                        </td>
                    </tr>
                    <tr className="even:bg-muted m-0 border-t p-0">
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Modest
                        </td>
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Satisfied
                        </td>
                    </tr>
                    <tr className="even:bg-muted m-0 border-t p-0">
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Full
                        </td>
                        <td className="border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right">
                            Ecstatic
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}

export function List() {
    return (
        <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
            <li>1st level of puns: 5 gold coins</li>
            <li>2nd level of jokes: 10 gold coins</li>
            <li>3rd level of one-liners : 20 gold coins</li>
        </ul>
    )
}

export function InlineCode() {
    return (
        <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
            @radix-ui/react-alert-dialog
        </code>
    )
}

export function Lead() {
    return (
        <p className="text-muted-foreground text-xl">
            A modal dialog that interrupts the user with important content and expects
            a response.
        </p>
    )
}

export function Large() {
    return <div className="text-lg font-semibold">Are you absolutely sure?</div>
}

export function Small() {
    return (
        <small className="text-sm leading-none font-medium">Email address</small>
    )
}

export function Muted() {
    return (
        <p className="text-muted-foreground text-sm">Enter your email address.</p>
    )
}
