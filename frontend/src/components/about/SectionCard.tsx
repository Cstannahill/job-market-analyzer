import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

type SectionCardProps = {
    children: React.ReactNode;
    title: string;
}
const SectionCard: React.FC<SectionCardProps> = (props) => {
    const { children, title } = props;
    return (
        <Card className="bg-card/90 my-3 about-section-card backdrop-blur-sm border border-chart-4 shadow-sm hover:shadow-md transition">
            <CardContent className="p-6">
                <CardHeader className="p-0 mb-2 section-card-header text-center border-b-2 border-chart-4">
                    <CardTitle className="section-card-title">
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {children}
                </CardContent>
            </CardContent>
        </Card>
    )
}

export default SectionCard;