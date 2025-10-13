import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const FeatureCard = ({ title, description }: { title: string; description: string }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
        <Card className="bg-card/60 backdrop-blur-sm border border-border/60 shadow-sm hover:shadow-md transition feature-card min-h-full">
            <CardContent className="p-6">
                <CardHeader className="p-0 mb-4 feature-card-header text-center border-b-2">
                    <CardTitle>
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardDescription className="mt-3 feature-card-description">
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </CardDescription>
            </CardContent>
        </Card>
    </motion.div>
);

export default FeatureCard;