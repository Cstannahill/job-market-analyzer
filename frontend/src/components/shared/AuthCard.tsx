import { Card, CardContent } from "@/components/ui/card"

type AuthCardProps = {
    children: React.ReactNode;
    className?: string;
}
const AuthCard: React.FC<AuthCardProps> = (props) => {
    const { children, className } = props;
    return (
        <Card className={`bg-card/90  about-section-card backdrop-blur-sm border border-chart-4 shadow-sm hover:shadow-md transition ${className} my-3`}>
            <CardContent className="p-3">

                <CardContent>
                    {children}
                </CardContent>
            </CardContent>
        </Card>
    )
}

export default AuthCard;