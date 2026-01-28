import React from 'react';
import { Card, Badge, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, WifiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    calendarIconStyle,
    getLiveIconStyle,
    headerContainerStyle,
    headerMainContentStyle,
    headerTimeRowStyle,
    liveStatusTextStyle,
    pageHeaderCardStyle,
    timeIconStyle,
    timeSubTextStyle,
    timeTextStyle,
    uiDividerStyle,
} from './styles';

const { Text } = Typography;


interface PageHeaderProps {
    children: React.ReactNode;
    showTime?: boolean;
    showLiveStatus?: boolean;
    isConnected?: boolean;
    extra?: React.ReactNode;
}

/**
 * Standart sahifa header komponenti - Dashboard uslubida
 * Kompakt Card ichida statistikalar, filter'lar va vaqt ko'rsatadi
 */
const PageHeader: React.FC<PageHeaderProps> = ({
    children,
    showTime = false,
    showLiveStatus = false,
    isConnected = false,
    extra,
}) => {
    const [currentTime, setCurrentTime] = React.useState(dayjs());

    React.useEffect(() => {
        if (!showTime) return;
        const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
        return () => clearInterval(timer);
    }, [showTime]);

    return (
        <Card size="small" style={pageHeaderCardStyle}>
            <div style={headerContainerStyle}>
                {/* Vaqt */}
                {showTime && (
                    <>
                        <div style={headerTimeRowStyle}>
                            <ClockCircleOutlined style={timeIconStyle} />
                            <Text strong style={timeTextStyle}>{currentTime.format('HH:mm')}</Text>
                            <Text type="secondary" style={timeSubTextStyle}>
                                <CalendarOutlined style={calendarIconStyle} />
                                {currentTime.format('DD MMM, ddd')}
                            </Text>
                        </div>
                        <Divider />
                    </>
                )}

                {/* Jonli status */}
                {showLiveStatus && (
                    <>
                        <Tooltip title={isConnected ? 'Real vaqt ulangan' : 'Oflayn'}>
                            <Badge
                                status={isConnected ? 'success' : 'error'}
                                text={
                                    <span style={liveStatusTextStyle}>
                                        <WifiOutlined style={getLiveIconStyle(isConnected)} />
                                        {isConnected ? 'Jonli' : 'Oflayn'}
                                    </span>
                                }
                            />
                        </Tooltip>
                        <Divider />
                    </>
                )}

                {/* Main content (statistikalar, filterlar) */}
                <div style={headerMainContentStyle}>
                    {children}
                </div>

                {/* Extra content (qo'shimcha tugmalar) */}
                {extra && (
                    <>
                        <Divider />
                        {extra}
                    </>
                )}
            </div>
        </Card>
    );
};

/**
 * Vertikal divider - header ichida
 */
const Divider: React.FC = () => <div style={uiDividerStyle} />;

export { PageHeader, Divider };
export default PageHeader;
