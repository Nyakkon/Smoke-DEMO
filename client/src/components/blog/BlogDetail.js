import React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Paper,
    Divider,
    Button,
    Breadcrumbs,
    Chip,
    Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Dữ liệu mẫu cho các bài blog
const blogPosts = [
    {
        id: 1,
        title: 'Benefits of Quitting Smoking',
        image: 'https://placehold.co/800x400/3178bd/white?text=Benefits+of+Quitting',
        author: 'Dr. Sarah Johnson',
        date: 'May 15, 2023',
        category: 'Health Benefits',
        content: `
            <p>The health benefits of quitting smoking can help most of the major parts of your body: from your brain to your DNA. The moment you stop smoking, your body begins to heal itself.</p>
            
            <h3>Brain</h3>
            <p>Quitting smoking can re-wire your brain and help break the cycle of addiction. The large number of nicotine receptors in your brain will return to normal levels after about a month of being quit.</p>
            
            <h3>Head and Face</h3>
            <p>Quitting smoking will keep your hearing sharp. Remember, even mild hearing loss can cause problems. Stopping smoking will improve your night vision and help preserve your overall vision by stopping the damage that smoking does to your eyes.</p>
            
            <h3>Heart</h3>
            <p>Smoking is the leading cause of heart attacks and heart disease. But many of these heart risks can be reversed simply by quitting smoking. Quitting can lower your blood pressure and heart rate almost immediately. Your risk of a heart attack declines within 24 hours.</p>
            
            <h3>Lungs</h3>
            <p>Scarring of the lungs is not reversible. That is why it is important to quit smoking before you do permanent damage to your lungs. Within two weeks of quitting, you might notice it's easier to walk up the stairs because you may be less short of breath.</p>
            
            <h3>DNA</h3>
            <p>Quitting smoking will prevent new DNA damage from happening and can even help repair the damage that has already been done. Quitting smoking immediately is the best way to lower your risk of getting cancer.</p>
            
            <h3>Conclusion</h3>
            <p>Quitting smoking is one of the most important things you can do for your health. The benefits begin within minutes of your last cigarette and continue to grow as time passes.</p>
        `
    },
    {
        id: 2,
        title: 'Coping Strategies for Nicotine Withdrawal',
        image: 'https://placehold.co/800x400/3178bd/white?text=Coping+Strategies',
        author: 'Michael Rodriguez, LMHC',
        date: 'June 2, 2023',
        category: 'Quit Techniques',
        content: `
            <p>When you quit smoking, your body goes through nicotine withdrawal, which can be challenging but manageable with the right strategies.</p>
            
            <h3>Understanding Nicotine Withdrawal</h3>
            <p>Nicotine withdrawal occurs when you stop using tobacco products after your body has become dependent on nicotine. Symptoms typically begin within a few hours of your last cigarette and peak within the first few days.</p>
            
            <h3>The 4 Ds Method</h3>
            <p>When cravings hit, remember the 4 Ds: Delay, Deep breathe, Drink water, and Do something else. Delay acting on the urge to smoke; cravings typically pass within 3-5 minutes.</p>
            
            <h3>Physical Activity</h3>
            <p>Exercise is one of the most effective ways to cope with nicotine withdrawal. Even short bursts of physical activity can reduce cravings and improve mood by releasing endorphins, the body's natural feel-good chemicals.</p>
            
            <h3>Conclusion</h3>
            <p>Remember that quitting smoking is a process, not an event. There may be setbacks along the way, but each attempt brings you closer to becoming smoke-free.</p>
        `
    },
    {
        id: 3,
        title: 'Mindfulness Techniques for Smoking Cessation',
        image: 'https://placehold.co/800x400/3178bd/white?text=Mindfulness+Techniques',
        author: 'Emma Chen, PhD',
        date: 'July 10, 2023',
        category: 'Mental Health',
        content: `
            <p>Mindfulness practices can be powerful tools in your journey to quit smoking. By bringing awareness to your cravings, thoughts, and emotions without judgment, you can develop a healthier relationship with yourself.</p>
            
            <h3>What is Mindfulness?</h3>
            <p>Mindfulness is the practice of paying attention to the present moment with curiosity, openness, and acceptance. It involves observing your thoughts, feelings, bodily sensations, and surrounding environment without judgment.</p>
            
            <h3>RAIN Technique for Cravings</h3>
            <p>RAIN is a mindfulness technique particularly helpful for managing cigarette cravings. R - Recognize when a craving appears. A - Allow the craving to be there without trying to push it away or giving in to it. I - Investigate with interest how the craving feels in your body. N - Non-identification means understanding that you are not your craving.</p>
            
            <h3>Conclusion</h3>
            <p>Incorporating mindfulness into your smoking cessation plan can significantly increase your chances of quitting successfully and staying smoke-free.</p>
        `
    },
    {
        id: 4,
        title: 'Building a Strong Support System',
        image: 'https://placehold.co/800x400/3178bd/white?text=Support+System',
        author: 'James Wilson',
        date: 'August 8, 2023',
        category: 'Support & Community',
        content: `
            <p>Quitting smoking is challenging, but you don't have to face it alone. A strong support system can significantly increase your chances of successfully quitting and staying smoke-free.</p>
            
            <h3>The Power of Social Support</h3>
            <p>Research consistently shows that smokers who have strong social support are more likely to successfully quit and remain smoke-free. Support from others can provide encouragement, accountability, practical help, and emotional comfort during difficult moments.</p>
            
            <h3>Family and Friends</h3>
            <p>Start by having honest conversations with your closest family members and friends about your decision to quit smoking. Be specific about how they can help you—whether it's checking in regularly, providing distractions during cravings, or simply being understanding if you're irritable during withdrawal.</p>
            
            <h3>Conclusion</h3>
            <p>Building a comprehensive support system is one of the most important steps you can take when quitting smoking. Remember that seeking support isn't a sign of weakness—it's a smart strategy that significantly improves your chances of becoming smoke-free for good.</p>
        `
    },
    {
        id: 5,
        title: 'Nutrition Tips for Ex-Smokers',
        image: 'https://placehold.co/800x400/3178bd/white?text=Nutrition+Tips',
        author: 'Dr. Lisa Patel, RD',
        date: 'September 15, 2023',
        category: 'Nutrition & Wellness',
        content: `
            <p>When you quit smoking, your body begins an amazing healing process. Proper nutrition during this time can support this healing, help manage cravings, and prevent weight gain.</p>
            
            <h3>Antioxidant-Rich Foods</h3>
            <p>Smoking causes oxidative stress and depletes antioxidants in your body. Consuming antioxidant-rich foods can help repair this damage and support healing. Focus on eating a rainbow of fruits and vegetables, which contain different types of antioxidants.</p>
            
            <h3>Hydration and Detoxification</h3>
            <p>Staying well-hydrated helps your body flush out toxins and can reduce the intensity of nicotine cravings. Water is the best choice, but herbal teas can also contribute to your fluid intake while providing additional health benefits.</p>
            
            <h3>Conclusion</h3>
            <p>Good nutrition is a powerful ally in your journey to become smoke-free. By focusing on antioxidant-rich foods, staying well-hydrated, managing oral fixation with healthy alternatives, and stabilizing blood sugar, you can support your body's healing process.</p>
        `
    }
];

const BlogDetail = () => {
    const { postId } = useParams();
    const post = blogPosts.find(post => post.id === parseInt(postId)) || blogPosts[0];

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Breadcrumbs */}
            <Breadcrumbs sx={{ mb: 4 }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                    Home
                </Link>
                <Link to="/blog" style={{ textDecoration: 'none', color: 'inherit' }}>
                    Blog
                </Link>
                <Typography color="text.primary">{post.title}</Typography>
            </Breadcrumbs>

            <Paper elevation={0} sx={{ p: 4, mb: 4 }}>
                {/* Category */}
                <Chip 
                    label={post.category} 
                    color="primary" 
                    size="small" 
                    sx={{ mb: 2 }} 
                />
                
                {/* Title */}
                <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                    {post.title}
                </Typography>
                
                {/* Author and date */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                        {post.author}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                        {post.date}
                    </Typography>
                </Box>
                
                {/* Featured image */}
                <Box
                    component="img"
                    src={post.image}
                    alt={post.title}
                    sx={{
                        width: '100%',
                        borderRadius: 2,
                        mb: 4
                    }}
                />
                
                {/* Content */}
                <Box 
                    dangerouslySetInnerHTML={{ __html: post.content }} 
                    sx={{ 
                        '& p': { mb: 2, lineHeight: 1.7 },
                        '& h3': { mt: 4, mb: 2, color: 'primary.main', fontWeight: 'bold' }
                    }}
                />
            </Paper>

            {/* Back button */}
            <Button 
                startIcon={<ArrowBackIcon />} 
                component={Link} 
                to="/blog" 
                sx={{ mb: 4 }}
            >
                Back to all articles
            </Button>
        </Container>
    );
};

export default BlogDetail; 