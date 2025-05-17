import React from 'react';
import { Link } from 'react-router-dom';
import {
    Container,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Typography,
    Box,
    Chip,
    Divider
} from '@mui/material';

// Mock data for smoking cessation blog posts
const blogPosts = [
    {
        id: 1,
        title: 'Benefits of Quitting Smoking',
        excerpt: 'The health benefits of quitting smoking can help most of the major parts of your body: from your brain to your DNA.',
        image: 'https://placehold.co/600x400/3178bd/white?text=Benefits+of+Quitting',
        authorName: 'Dr. Sarah Johnson',
        date: 'May 15, 2023',
        readTime: '8 min read',
        category: 'Health Benefits'
    },
    {
        id: 2,
        title: 'Coping Strategies for Nicotine Withdrawal',
        excerpt: 'Proven techniques to manage cravings and withdrawal symptoms during your journey to become smoke-free.',
        image: 'https://placehold.co/600x400/3178bd/white?text=Coping+Strategies',
        authorName: 'Michael Rodriguez, LMHC',
        date: 'June 2, 2023',
        readTime: '6 min read',
        category: 'Quit Techniques'
    },
    {
        id: 3,
        title: 'Mindfulness Techniques for Smoking Cessation',
        excerpt: 'How mindfulness and meditation can help you overcome smoking addiction and reduce stress naturally.',
        image: 'https://placehold.co/600x400/3178bd/white?text=Mindfulness+Techniques',
        authorName: 'Emma Chen, PhD',
        date: 'July 10, 2023',
        readTime: '5 min read',
        category: 'Mental Health'
    },
    {
        id: 4,
        title: 'Building a Strong Support System',
        excerpt: 'The importance of having supportive people around you and how to create a network that helps your quitting journey.',
        image: 'https://placehold.co/600x400/3178bd/white?text=Support+System',
        authorName: 'James Wilson',
        date: 'August 8, 2023',
        readTime: '7 min read',
        category: 'Support & Community'
    },
    {
        id: 5,
        title: 'Nutrition Tips for Ex-Smokers',
        excerpt: 'Foods that can help detoxify your body, reduce cravings, and prevent weight gain after quitting smoking.',
        image: 'https://placehold.co/600x400/3178bd/white?text=Nutrition+Tips',
        authorName: 'Dr. Lisa Patel, RD',
        date: 'September 15, 2023',
        readTime: '6 min read',
        category: 'Nutrition & Wellness'
    }
];

const BlogList = () => {
    return (
        <>
            {/* Hero Section */}
            <Box sx={{ bgcolor: '#3178bd', color: 'white', py: 6 }}>
                <Container maxWidth="lg">
                    <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
                        Smoking Cessation Resources
                    </Typography>
                    <Typography variant="h6" sx={{ maxWidth: '800px', mb: 3 }}>
                        Expert advice, research-backed strategies, and personal stories to help you 
                        on your journey to becoming smoke-free.
                    </Typography>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 6 }}>
                {/* Featured Post */}
                <Box component={Link} to={`/blog/${blogPosts[0].id}`} sx={{ textDecoration: 'none', color: 'inherit', display: 'block', mb: 6 }}>
                    <Card sx={{ display: { xs: 'block', md: 'flex' }, overflow: 'hidden' }}>
                        <CardMedia
                            component="img"
                            sx={{ 
                                width: { xs: '100%', md: '50%' }, 
                                height: { xs: 240, md: 'auto' }
                            }}
                            image={blogPosts[0].image}
                            alt={blogPosts[0].title}
                        />
                        <Box sx={{ flex: 1 }}>
                            <CardContent sx={{ p: 4 }}>
                                <Chip 
                                    label={blogPosts[0].category} 
                                    color="primary" 
                                    size="small" 
                                    sx={{ mb: 2 }} 
                                />
                                <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
                                    {blogPosts[0].title}
                                </Typography>
                                <Typography variant="body1" paragraph color="text.secondary">
                                    {blogPosts[0].excerpt}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mr: 2 }}>
                                        {blogPosts[0].authorName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {blogPosts[0].date} · {blogPosts[0].readTime}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Box>
                    </Card>
                </Box>

                <Typography variant="h5" component="h3" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
                    Latest Articles
                </Typography>
                <Divider sx={{ mb: 4 }} />

                {/* Article Grid */}
                <Grid container spacing={4}>
                    {blogPosts.slice(1).map((post) => (
                        <Grid item key={post.id} xs={12} sm={6} md={3}>
                            <Card
                                component={Link}
                                to={`/blog/${post.id}`}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    '&:hover': {
                                        transform: 'translateY(-8px)',
                                        boxShadow: 6
                                    }
                                }}
                            >
                                <CardMedia
                                    component="img"
                                    height="180"
                                    image={post.image}
                                    alt={post.title}
                                />
                                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                                    <Typography variant="overline" color="primary.main">
                                        {post.category}
                                    </Typography>
                                    <Typography
                                        gutterBottom
                                        variant="h6"
                                        component="h2"
                                        fontWeight="bold"
                                        sx={{ minHeight: '3em' }}
                                    >
                                        {post.title}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            mb: 2
                                        }}
                                    >
                                        {post.excerpt}
                                    </Typography>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center', 
                                        mt: 'auto' 
                                    }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {post.date}
                                        </Typography>
                                        <Typography variant="caption" color="primary.main" fontWeight="medium">
                                            Read More
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Categories Section */}
                <Box sx={{ mt: 8, mb: 4 }}>
                    <Typography variant="h5" component="h3" gutterBottom fontWeight="bold">
                        Browse By Category
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    <Grid container spacing={2}>
                        {['Health Benefits', 'Quit Techniques', 'Mental Health', 'Support & Community', 'Nutrition & Wellness'].map((category) => (
                            <Grid item key={category}>
                                <Chip 
                                    label={category} 
                                    color="primary" 
                                    variant="outlined" 
                                    clickable
                                    sx={{ px: 1 }}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Container>
        </>
    );
};

export default BlogList; 